// KV-based rate limiting with TTL auto-expiry
// Key format: RATELIMIT:{ip}:{endpoint}
// Value: JSON { count, windowStart }

const LIMITS = {
    '/api/login': { max: 10, windowSec: 60 },
    '/api/register': { max: 5, windowSec: 60 },
    '/api/setup-account': { max: 5, windowSec: 60 },
    '/api/passkey/login-options': { max: 10, windowSec: 60 },
    '/api/passkey/login-verify': { max: 10, windowSec: 60 },
};

export async function checkRateLimit(kv, ip, pathname) {
    if (!kv) return null; // No KV, skip rate limiting

    const limit = LIMITS[pathname];
    if (!limit) return null; // No limit for this endpoint

    const key = `RATELIMIT:${ip}:${pathname}`;
    const now = Date.now();

    const raw = await kv.get(key);
    let data = raw ? JSON.parse(raw) : null;

    // If no record or window expired, start fresh
    if (!data || (now - data.windowStart) > limit.windowSec * 1000) {
        data = { count: 1, windowStart: now };
        await kv.put(key, JSON.stringify(data), { expirationTtl: limit.windowSec * 2 });
        return null;
    }

    data.count++;

    if (data.count > limit.max) {
        const retryAfter = Math.ceil((data.windowStart + limit.windowSec * 1000 - now) / 1000);
        await kv.put(key, JSON.stringify(data), { expirationTtl: limit.windowSec * 2 });
        return retryAfter > 0 ? retryAfter : 1;
    }

    await kv.put(key, JSON.stringify(data), { expirationTtl: limit.windowSec * 2 });
    return null;
}
