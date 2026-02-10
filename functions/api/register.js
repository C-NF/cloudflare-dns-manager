// Self-registration endpoint — only works when open registration is enabled.
// No authentication required.

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

    // Check if open registration is enabled
    const raw = await kv.get('APP_SETTINGS');
    const settings = raw ? JSON.parse(raw) : {};
    if (!settings.openRegistration) {
        return new Response(JSON.stringify({ error: 'Registration is disabled. Contact an admin for an invitation.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !username.trim()) {
        return new Response(JSON.stringify({ error: 'Username is required.' }), {
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
        return new Response(JSON.stringify({ error: 'Cannot register with username "admin".' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
        return new Response(JSON.stringify({ error: 'Username must contain only lowercase letters, numbers, hyphens, and underscores.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const existing = await kv.get(`USER:${cleanUsername}`);
    if (existing) {
        return new Response(JSON.stringify({ error: 'Username already taken.' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Hash with PBKDF2 (client sends SHA-256, we add PBKDF2 on top)
    const pbkdf2Hash = await hashPassword(password.trim());

    const userData = {
        username: cleanUsername,
        passwordHash: pbkdf2Hash,
        setupToken: null,
        status: 'active',
        role: 'user',
        createdAt: new Date().toISOString()
    };

    await kv.put(`USER:${cleanUsername}`, JSON.stringify(userData));
    await kv.put(`USER_TOKENS:${cleanUsername}`, JSON.stringify([]));

    const listJson = await kv.get('USER_LIST');
    const userList = listJson ? JSON.parse(listJson) : [];
    if (!userList.includes(cleanUsername)) {
        userList.push(cleanUsername);
        await kv.put('USER_LIST', JSON.stringify(userList));
    }

    return new Response(JSON.stringify({ success: true, message: 'Registration complete. You can now log in.' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
