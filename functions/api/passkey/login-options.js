// POST /api/passkey/login-options — generate WebAuthn authentication options
// No authentication required. User provides username to get their allowed credentials.

import { generateAuthenticationOptions } from '@simplewebauthn/server';

export async function onRequestPost(context) {
    const { request, env } = context;
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await request.json();
    const username = (body.username || '').trim().toLowerCase();

    if (!username) {
        return new Response(JSON.stringify({ error: 'Username is required.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const rpID = url.hostname;

    // Load user's credentials
    const credsJson = await kv.get(`PASSKEY_CREDS:${username}`);
    const creds = credsJson ? JSON.parse(credsJson) : [];

    if (creds.length === 0) {
        return new Response(JSON.stringify({ error: 'No passkeys registered for this user.' }), {
            status: 404, headers: { 'Content-Type': 'application/json' }
        });
    }

    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: creds.map(c => ({
            id: c.credentialId,
            transports: c.transports || [],
        })),
        userVerification: 'preferred',
    });

    // Store challenge with 5-min TTL
    await kv.put(`PASSKEY_CHALLENGE:${options.challenge}`, JSON.stringify({
        username,
        type: 'authentication',
    }), { expirationTtl: 300 });

    return new Response(JSON.stringify(options), {
        headers: { 'Content-Type': 'application/json' }
    });
}
