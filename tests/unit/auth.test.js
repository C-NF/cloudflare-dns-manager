import { getAuthHeaders, hashPassword, isPasswordStrong } from '../../src/utils/auth';

describe('getAuthHeaders', () => {
    it('returns empty object for null auth', () => {
        expect(getAuthHeaders(null)).toEqual({});
    });

    it('returns empty object for undefined auth', () => {
        expect(getAuthHeaders(undefined)).toEqual({});
    });

    it('returns X-Cloudflare-Token header for client mode', () => {
        const auth = { mode: 'client', token: 'my-cf-token' };
        expect(getAuthHeaders(auth)).toEqual({
            'X-Cloudflare-Token': 'my-cf-token',
        });
    });

    it('returns Bearer authorization and account index for server mode', () => {
        const auth = { mode: 'server', token: 'srv-token', currentAccountIndex: 2 };
        // Mock localStorage to return empty so the local token path is skipped
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');

        const result = getAuthHeaders(auth);
        expect(result).toEqual({
            'Authorization': 'Bearer srv-token',
            'X-Managed-Account-Index': '2',
        });

        vi.restoreAllMocks();
    });

    it('defaults currentAccountIndex to 0 in server mode when not provided', () => {
        const auth = { mode: 'server', token: 'srv-token' };
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');

        const result = getAuthHeaders(auth);
        expect(result).toEqual({
            'Authorization': 'Bearer srv-token',
            'X-Managed-Account-Index': '0',
        });

        vi.restoreAllMocks();
    });

    it('adds Content-Type when withType is true (client mode)', () => {
        const auth = { mode: 'client', token: 'tok' };
        const result = getAuthHeaders(auth, true);
        expect(result).toEqual({
            'X-Cloudflare-Token': 'tok',
            'Content-Type': 'application/json',
        });
    });

    it('adds Content-Type when withType is true (server mode)', () => {
        const auth = { mode: 'server', token: 'tok', currentAccountIndex: 1 };
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('{}');

        const result = getAuthHeaders(auth, true);
        expect(result).toEqual({
            'Authorization': 'Bearer tok',
            'X-Managed-Account-Index': '1',
            'Content-Type': 'application/json',
        });

        vi.restoreAllMocks();
    });

    it('uses local token when available in localStorage for server mode', () => {
        const auth = { mode: 'server', token: 'srv-token', username: 'alice', currentAccountIndex: 3 };
        const localTokens = { 'alice_3': 'local-tok-abc' };
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(localTokens));

        const result = getAuthHeaders(auth);
        expect(result).toEqual({
            'X-Cloudflare-Token': 'local-tok-abc',
        });

        vi.restoreAllMocks();
    });

    it('uses local token with Content-Type when withType is true', () => {
        const auth = { mode: 'server', token: 'srv-token', username: 'bob', currentAccountIndex: 0 };
        const localTokens = { 'bob_0': 'local-tok-xyz' };
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(localTokens));

        const result = getAuthHeaders(auth, true);
        expect(result).toEqual({
            'X-Cloudflare-Token': 'local-tok-xyz',
            'Content-Type': 'application/json',
        });

        vi.restoreAllMocks();
    });

    it('defaults username to admin and index to 0 for local token lookup', () => {
        const auth = { mode: 'server', token: 'srv-token' };
        const localTokens = { 'admin_0': 'default-local-tok' };
        vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(localTokens));

        const result = getAuthHeaders(auth);
        expect(result).toEqual({
            'X-Cloudflare-Token': 'default-local-tok',
        });

        vi.restoreAllMocks();
    });
});

describe('hashPassword', () => {
    it('returns a 64-character hex string', async () => {
        const hash = await hashPassword('testpassword');
        expect(hash).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('is deterministic - same input produces same output', async () => {
        const hash1 = await hashPassword('mypassword123');
        const hash2 = await hashPassword('mypassword123');
        expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', async () => {
        const hash1 = await hashPassword('password1');
        const hash2 = await hashPassword('password2');
        expect(hash1).not.toBe(hash2);
    });

    it('produces known SHA-256 hash for empty string', async () => {
        const hash = await hashPassword('');
        // SHA-256 of empty string is well-known
        expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
});

describe('isPasswordStrong', () => {
    it('rejects passwords shorter than 8 characters', () => {
        expect(isPasswordStrong('abc1')).toBe(false);
        expect(isPasswordStrong('Ab1')).toBe(false);
        expect(isPasswordStrong('a1b2c3d')).toBe(false);
    });

    it('rejects passwords without any letters', () => {
        expect(isPasswordStrong('12345678')).toBe(false);
        expect(isPasswordStrong('123456789012')).toBe(false);
    });

    it('rejects passwords without any numbers', () => {
        expect(isPasswordStrong('abcdefgh')).toBe(false);
        expect(isPasswordStrong('ABCDEFgh')).toBe(false);
    });

    it('accepts valid passwords with letters and numbers and length >= 8', () => {
        expect(isPasswordStrong('abcdefg1')).toBe(true);
        expect(isPasswordStrong('Password1')).toBe(true);
        expect(isPasswordStrong('12345678a')).toBe(true);
        expect(isPasswordStrong('A1B2C3D4')).toBe(true);
    });

    it('accepts passwords with special characters as long as base requirements are met', () => {
        expect(isPasswordStrong('p@ssw0rd!')).toBe(true);
        expect(isPasswordStrong('!@#$%abc1')).toBe(true);
    });

    it('accepts passwords at exactly 8 characters', () => {
        expect(isPasswordStrong('abcdefg1')).toBe(true);
    });
});
