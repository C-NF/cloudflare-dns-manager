import { validateUsername } from '../../functions/api/_validate';

describe('validateUsername', () => {
    it('returns error for null username', () => {
        expect(validateUsername(null)).toBe('Username is required.');
    });

    it('returns error for undefined username', () => {
        expect(validateUsername(undefined)).toBe('Username is required.');
    });

    it('returns error for empty string', () => {
        expect(validateUsername('')).toBe('Username is required.');
    });

    it('returns error for whitespace-only string', () => {
        expect(validateUsername('   ')).toBe('Username is required.');
    });

    it('returns error for username shorter than 2 characters', () => {
        expect(validateUsername('a')).toBe('Username must be at least 2 characters.');
    });

    it('returns error for username longer than 32 characters', () => {
        const long = 'a'.repeat(33);
        expect(validateUsername(long)).toBe('Username must be at most 32 characters.');
    });

    it('returns error for username with uppercase letters (after trimming/lowering, checks regex)', () => {
        // The function lowercases first, so uppercase letters alone won't fail the regex.
        // But characters like spaces or dots will fail.
        expect(validateUsername('user name')).toBe(
            'Username must contain only lowercase letters, numbers, hyphens, and underscores.'
        );
    });

    it('returns error for username with special characters', () => {
        expect(validateUsername('user@name')).toBe(
            'Username must contain only lowercase letters, numbers, hyphens, and underscores.'
        );
        expect(validateUsername('user.name')).toBe(
            'Username must contain only lowercase letters, numbers, hyphens, and underscores.'
        );
        expect(validateUsername('user!name')).toBe(
            'Username must contain only lowercase letters, numbers, hyphens, and underscores.'
        );
    });

    it('returns error for username with spaces in the middle', () => {
        expect(validateUsername('ab cd')).toBe(
            'Username must contain only lowercase letters, numbers, hyphens, and underscores.'
        );
    });

    it('returns null for valid simple username', () => {
        expect(validateUsername('admin')).toBeNull();
    });

    it('returns null for valid username with numbers', () => {
        expect(validateUsername('user123')).toBeNull();
    });

    it('returns null for valid username with hyphens', () => {
        expect(validateUsername('my-user')).toBeNull();
    });

    it('returns null for valid username with underscores', () => {
        expect(validateUsername('my_user')).toBeNull();
    });

    it('returns null for valid 2-character username (minimum length)', () => {
        expect(validateUsername('ab')).toBeNull();
    });

    it('returns null for valid 32-character username (maximum length)', () => {
        const maxLen = 'a'.repeat(32);
        expect(validateUsername(maxLen)).toBeNull();
    });

    it('trims leading and trailing whitespace before validating', () => {
        expect(validateUsername('  admin  ')).toBeNull();
    });

    it('lowercases the username before regex check', () => {
        // Uppercase letters are allowed because they get lowercased
        expect(validateUsername('Admin')).toBeNull();
        expect(validateUsername('USER123')).toBeNull();
    });
});
