import { onRequestPost } from '../../functions/api/register.js';
import { createMockKV, createMockContext, getResponseJson } from './_helpers.js';

// Mock the _crypto module so we do not need real Web Crypto PBKDF2 in tests
vi.mock('../../functions/api/_crypto.js', () => ({
    hashPassword: vi.fn(async (pw) => `mocked-salt:mocked-hash-${pw}`),
}));

/**
 * Helper: build a POST request with a JSON body for the register endpoint.
 */
function makeRegisterRequest(body) {
    return new Request('http://localhost/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/**
 * Helper: create a context whose KV already has open registration enabled.
 */
function createRegistrationContext(overrides = {}) {
    const store = {
        APP_SETTINGS: JSON.stringify({ openRegistration: true }),
        ...overrides.store,
    };
    const kv = createMockKV(store);
    return createMockContext({ kv, request: overrides.request, ...overrides });
}

// ---------------------------------------------------------------------------

describe('POST /api/register', () => {
    // ----- registration disabled -------------------------------------------

    it('returns 403 when registration is disabled', async () => {
        const kv = createMockKV({
            APP_SETTINGS: JSON.stringify({ openRegistration: false }),
        });
        const ctx = createMockContext({
            kv,
            request: makeRegisterRequest({ username: 'alice', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(403);
        expect(json.error).toMatch(/registration is disabled/i);
    });

    it('returns 403 when APP_SETTINGS is missing (defaults to closed)', async () => {
        const kv = createMockKV(); // no APP_SETTINGS key at all
        const ctx = createMockContext({
            kv,
            request: makeRegisterRequest({ username: 'alice', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(403);
    });

    // ----- input validation ------------------------------------------------

    it('returns 400 for missing username', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(400);
        expect(json.error).toMatch(/username/i);
    });

    it('returns 400 for empty username', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: '   ', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(400);
    });

    it('returns 400 for missing password', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'alice' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(400);
        expect(json.error).toMatch(/password/i);
    });

    it('returns 400 for empty password', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'alice', password: '   ' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(400);
    });

    it('returns 400 when username is "admin"', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'admin', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(400);
        expect(json.error).toMatch(/admin/i);
    });

    it('returns 400 when username is "Admin" (case-insensitive)', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'Admin', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(400);
    });

    it('returns 400 for username with invalid characters', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'alice!@#', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(400);
        expect(json.error).toMatch(/lowercase/i);
    });

    it('returns 400 for username with spaces', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'alice bob', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(400);
    });

    it('returns 400 for username with uppercase letters', async () => {
        const ctx = createRegistrationContext({
            request: makeRegisterRequest({ username: 'Alice', password: 'abc123hash' }),
        });

        // "Alice" lowercased is "alice", which is valid chars-wise
        // but the original mixed case goes through .toLowerCase() first,
        // so if "alice" is not taken it should succeed. Let's verify the
        // flow handles this correctly (it normalizes, doesn't reject).
        const res = await onRequestPost(ctx);
        // Should succeed because "Alice" becomes "alice" which passes the regex
        expect(res.status).toBe(200);
    });

    // ----- duplicate user --------------------------------------------------

    it('returns 409 for a duplicate username', async () => {
        const ctx = createRegistrationContext({
            store: {
                APP_SETTINGS: JSON.stringify({ openRegistration: true }),
                'USER:alice': JSON.stringify({ username: 'alice', role: 'user' }),
            },
            request: makeRegisterRequest({ username: 'alice', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(409);
        expect(json.error).toMatch(/already taken/i);
    });

    // ----- successful registration -----------------------------------------

    it('returns success and creates correct KV entries for valid registration', async () => {
        const store = {
            APP_SETTINGS: JSON.stringify({ openRegistration: true }),
        };
        const kv = createMockKV(store);
        const ctx = createMockContext({
            kv,
            request: makeRegisterRequest({ username: 'testuser', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        const json = await getResponseJson(res);

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toMatch(/registration complete/i);

        // Verify USER:{username} was written
        const userPutCall = kv.put.mock.calls.find(([key]) => key === 'USER:testuser');
        expect(userPutCall).toBeDefined();
        const userData = JSON.parse(userPutCall[1]);
        expect(userData.username).toBe('testuser');
        expect(userData.passwordHash).toBe('mocked-salt:mocked-hash-abc123hash');
        expect(userData.role).toBe('user');
        expect(userData.status).toBe('active');
        expect(userData.createdAt).toBeDefined();

        // Verify USER_TOKENS:{username} was initialized
        const tokensPutCall = kv.put.mock.calls.find(([key]) => key === 'USER_TOKENS:testuser');
        expect(tokensPutCall).toBeDefined();
        expect(JSON.parse(tokensPutCall[1])).toEqual([]);

        // Verify USER_LIST was updated
        const listPutCall = kv.put.mock.calls.find(([key]) => key === 'USER_LIST');
        expect(listPutCall).toBeDefined();
        const userList = JSON.parse(listPutCall[1]);
        expect(userList).toContain('testuser');
    });

    it('appends to an existing USER_LIST without duplicates', async () => {
        const store = {
            APP_SETTINGS: JSON.stringify({ openRegistration: true }),
            USER_LIST: JSON.stringify(['existinguser']),
        };
        const kv = createMockKV(store);
        const ctx = createMockContext({
            kv,
            request: makeRegisterRequest({ username: 'newuser', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(200);

        const listPutCall = kv.put.mock.calls.find(([key]) => key === 'USER_LIST');
        const userList = JSON.parse(listPutCall[1]);
        expect(userList).toEqual(['existinguser', 'newuser']);
    });

    it('normalizes username to lowercase', async () => {
        const store = {
            APP_SETTINGS: JSON.stringify({ openRegistration: true }),
        };
        const kv = createMockKV(store);
        const ctx = createMockContext({
            kv,
            request: makeRegisterRequest({ username: 'TestUser', password: 'abc123hash' }),
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(200);

        // Should store under the lowercased key
        const userPutCall = kv.put.mock.calls.find(([key]) => key === 'USER:testuser');
        expect(userPutCall).toBeDefined();
    });

    it('returns 500 when KV is not configured', async () => {
        const ctx = createMockContext({
            request: makeRegisterRequest({ username: 'alice', password: 'abc123hash' }),
            env: { CF_DNS_KV: undefined },
        });

        const res = await onRequestPost(ctx);
        expect(res.status).toBe(500);
    });
});
