import { jwtVerify } from 'jose';
import { logAudit } from './_audit.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const serverPassword = env.APP_PASSWORD;
    if (!serverPassword) {
        return new Response(JSON.stringify({ error: 'Server not configured.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const kv = env.CF_DNS_KV;
    const secret = new TextEncoder().encode(serverPassword);

    // The user is already authenticated via the middleware (Bearer token).
    // Extract username from context set by middleware.
    const user = context.data.user;
    const username = user ? user.username : 'unknown';

    // Read refresh token from request body to revoke it
    let refreshToken = null;
    try {
        const body = await request.json();
        refreshToken = body.refreshToken;
    } catch {
        // Body may be empty or malformed -- that's okay, we still log out
    }

    if (refreshToken && kv) {
        try {
            const { payload } = await jwtVerify(refreshToken, secret);

            if (payload.type === 'refresh' && payload.jti) {
                // Store revocation with TTL of 7 days (matching refresh token lifetime)
                const SEVEN_DAYS = 7 * 24 * 60 * 60;
                await kv.put(`REVOKED_RT:${payload.jti}`, 'revoked', {
                    expirationTtl: SEVEN_DAYS
                });
            }
        } catch {
            // Refresh token may be invalid or expired -- ignore, still log out
        }
    }

    await logAudit(kv, username, 'auth.logout', 'Logged out');

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
