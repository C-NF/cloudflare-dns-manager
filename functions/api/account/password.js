// Self-service password change (authenticated users only, not admin)

import { hashPassword, verifyPassword, isLegacyHash } from '../_crypto.js';

export async function onRequestPost(context) {
    const { env } = context;
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const user = context.data.user;
    if (!user || !user.username) {
        return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await context.request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
        return new Response(JSON.stringify({ error: 'Current and new passwords are required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const username = user.username;

    if (username === 'admin') {
        // Admin password is APP_PASSWORD env var — cannot be changed at runtime
        return new Response(JSON.stringify({ error: 'Admin password is managed via environment variables.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const dataJson = await kv.get(`USER:${username}`);
    if (!dataJson) {
        return new Response(JSON.stringify({ error: 'User not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const userData = JSON.parse(dataJson);

    // Verify current password (handle both legacy SHA-256 and PBKDF2 formats)
    let verified = false;
    if (isLegacyHash(userData.passwordHash)) {
        verified = currentPassword === userData.passwordHash;
    } else {
        verified = await verifyPassword(currentPassword, userData.passwordHash);
    }

    if (!verified) {
        return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Store new password with PBKDF2
    userData.passwordHash = await hashPassword(newPassword);
    await kv.put(`USER:${username}`, JSON.stringify(userData));

    return new Response(JSON.stringify({ success: true, message: 'Password updated.' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
