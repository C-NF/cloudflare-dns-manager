/**
 * Shared test helpers for API endpoint tests.
 *
 * Provides factory functions for building mock Cloudflare Pages Function
 * contexts so that each test can exercise handler logic without a real
 * Workers runtime.
 */

/**
 * Create a mock KV namespace backed by a plain object.
 * All methods are vi.fn() spies so callers can assert on calls.
 */
export function createMockKV(store = {}) {
    return {
        get: vi.fn(async (key) => store[key] || null),
        put: vi.fn(async (key, value, opts) => { store[key] = value; }),
        delete: vi.fn(async (key) => { delete store[key]; }),
    };
}

/**
 * Build a full Pages Function context object.
 *
 * @param {object} overrides - Any property to override on the default context.
 * @returns {{ request: Request, env: object, params: object, data: object, next: Function }}
 */
export function createMockContext(overrides = {}) {
    const kv = overrides.kv || createMockKV();
    return {
        request: overrides.request || new Request('http://localhost/api/test', { method: 'GET' }),
        env: {
            CF_DNS_KV: kv,
            APP_PASSWORD: overrides.appPassword || 'test-password',
            ...overrides.env,
        },
        params: overrides.params || {},
        data: overrides.data || {},
        next: overrides.next || vi.fn(async () => new Response('OK')),
    };
}

/**
 * Convenience wrapper that awaits and parses a Response as JSON.
 */
export async function getResponseJson(response) {
    return response.json();
}
