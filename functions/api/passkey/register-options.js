// GET /api/passkey/register-options — generate WebAuthn registration options
// Requires authentication (JWT). User must be logged in to register a passkey.

import { generateRegistrationOptions } from '@simplewebauthn/server';

export async function onRequestGet(context) {
    const { request, env } = context;
    const kv = env.CF_DNS_KV;
    const user = context.data.user;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!user || !user.username) {
        return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const rpID = url.hostname;
    const rpName = 'CF DNS Manager';

    // Load existing credentials to exclude
    const credsJson = await kv.get(`PASSKEY_CREDS:${user.username}`);
    const existingCreds = credsJson ? JSON.parse(credsJson) : [];

    // Generate a stable userID from username
    const userIDBytes = new TextEncoder().encode(user.username);

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.username,
        userID: userIDBytes,
        attestationType: 'none',
        excludeCredentials: existingCreds.map(c => ({
            id: c.credentialId,
            transports: c.transports || [],
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
    });

    // Store challenge in KV with 5-min TTL
    await kv.put(`PASSKEY_CHALLENGE:${options.challenge}`, JSON.stringify({
        username: user.username,
        type: 'registration',
    }), { expirationTtl: 300 });

    return new Response(JSON.stringify(options), {
        headers: { 'Content-Type': 'application/json' }
    });
}
