// Account setup endpoint — allows new users to set their password using a setup token.
// No authentication required (like login).

import { hashPassword } from './_crypto.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await request.json();
    const { username, setupToken, password } = body;

    if (!username || !username.trim()) {
        return new Response(JSON.stringify({ error: 'Username is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!setupToken || !setupToken.trim()) {
        return new Response(JSON.stringify({ error: 'Setup token is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!password || !password.trim()) {
        return new Response(JSON.stringify({ error: 'Password is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (cleanUsername === 'admin') {
        return new Response(JSON.stringify({ error: 'Admin account cannot be set up this way.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const dataJson = await kv.get(`USER:${cleanUsername}`);
    if (!dataJson) {
        return new Response(JSON.stringify({ error: 'User not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const userData = JSON.parse(dataJson);

    // Verify setup token matches
    if (!userData.setupToken || userData.setupToken !== setupToken.trim()) {
        return new Response(JSON.stringify({ error: 'Invalid setup token.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Hash with PBKDF2 (client sends SHA-256 hash, we add PBKDF2 on top)
    userData.passwordHash = await hashPassword(password.trim());
    userData.setupToken = null;
    userData.status = 'active';

    await kv.put(`USER:${cleanUsername}`, JSON.stringify(userData));

    return new Response(JSON.stringify({ success: true, message: 'Account setup complete. You can now log in.' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
