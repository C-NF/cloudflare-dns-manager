import { checkRateLimit } from '../../functions/api/_rate-limit.js';
import { createMockKV } from './_helpers.js';

describe('checkRateLimit', () => {
    it('returns null when kv is null', async () => {
        const result = await checkRateLimit(null, '1.2.3.4', '/api/login');
        expect(result).toBeNull();
    });

    it('returns null for an unlisted endpoint', async () => {
        const kv = createMockKV();
        const result = await checkRateLimit(kv, '1.2.3.4', '/api/zones');
        expect(result).toBeNull();
        // KV should not even be queried for unlisted endpoints
        expect(kv.get).not.toHaveBeenCalled();
    });

    it('returns null on the first request to a rate-limited endpoint', async () => {
        const kv = createMockKV();
        const result = await checkRateLimit(kv, '1.2.3.4', '/api/login');
        expect(result).toBeNull();

        // A new window should have been stored
        expect(kv.put).toHaveBeenCalledTimes(1);
        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);
        expect(stored.count).toBe(1);
        expect(stored.windowStart).toBeGreaterThan(0);
    });

    it('returns null while under the rate limit', async () => {
        const now = Date.now();
        const kv = createMockKV();

        // Simulate 9 previous requests within the current window (max for /api/login is 10)
        const existingData = { count: 9, windowStart: now - 5000 };
        const key = 'RATELIMIT:1.2.3.4:/api/login';
        kv.get.mockResolvedValue(JSON.stringify(existingData));

        const result = await checkRateLimit(kv, '1.2.3.4', '/api/login');
        expect(result).toBeNull();

        // Count should have been incremented to 10
        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);
        expect(stored.count).toBe(10);
    });

    it('returns retry-after seconds when exceeding the rate limit', async () => {
        const now = Date.now();
        const kv = createMockKV();

        // Simulate exactly at the limit (10 previous requests for /api/login with max 10)
        const existingData = { count: 10, windowStart: now - 5000 };
        kv.get.mockResolvedValue(JSON.stringify(existingData));

        const result = await checkRateLimit(kv, '1.2.3.4', '/api/login');

        // Should return a positive integer (seconds to wait)
        expect(result).toBeGreaterThan(0);
        // retry-after should be roughly (60 - 5) = 55 seconds
        expect(result).toBeLessThanOrEqual(60);
    });

    it('resets the counter after the window expires', async () => {
        const now = Date.now();
        const kv = createMockKV();

        // Window started 120 seconds ago (well past the 60-second window for /api/login)
        const expiredData = { count: 50, windowStart: now - 120_000 };
        kv.get.mockResolvedValue(JSON.stringify(expiredData));

        const result = await checkRateLimit(kv, '1.2.3.4', '/api/login');
        expect(result).toBeNull();

        // A fresh window should be stored with count = 1
        const storedJson = kv.put.mock.calls[0][1];
        const stored = JSON.parse(storedJson);
        expect(stored.count).toBe(1);
    });

    it('uses the correct KV key format', async () => {
        const kv = createMockKV();

        await checkRateLimit(kv, '10.0.0.1', '/api/register');

        expect(kv.get).toHaveBeenCalledWith('RATELIMIT:10.0.0.1:/api/register');
    });

    it('stores with expirationTtl set to double the window', async () => {
        const kv = createMockKV();

        await checkRateLimit(kv, '1.2.3.4', '/api/register');

        // /api/register has windowSec: 60, so TTL should be 120
        expect(kv.put).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            { expirationTtl: 120 },
        );
    });

    it('returns at least 1 even when the computed retry-after is zero or negative', async () => {
        const now = Date.now();
        const kv = createMockKV();

        // Window started almost exactly 60 seconds ago, so retry-after would be ~0
        const existingData = { count: 10, windowStart: now - 59_999 };
        kv.get.mockResolvedValue(JSON.stringify(existingData));

        const result = await checkRateLimit(kv, '1.2.3.4', '/api/login');
        expect(result).toBeGreaterThanOrEqual(1);
    });

    it('enforces different limits per endpoint', async () => {
        const now = Date.now();

        // /api/register has max: 5 -- 5 previous requests should be the limit
        const kv = createMockKV();
        const data = { count: 5, windowStart: now - 1000 };
        kv.get.mockResolvedValue(JSON.stringify(data));

        const result = await checkRateLimit(kv, '1.2.3.4', '/api/register');
        // count becomes 6 which is > 5, so should be rate limited
        expect(result).toBeGreaterThan(0);
    });
});
