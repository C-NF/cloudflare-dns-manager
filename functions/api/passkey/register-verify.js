// POST /api/passkey/register-verify — verify WebAuthn registration response and store credential
// Requires authentication (JWT).

import { verifyRegistrationResponse } from '@simplewebauthn/server';

function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

export async function onRequestPost(context) {
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

    const body = await request.json();
    const url = new URL(request.url);
    const rpID = url.hostname;
    const origin = url.origin;

    // Verify against stored challenge
    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: async (challenge) => {
                const stored = await kv.get(`PASSKEY_CHALLENGE:${challenge}`);
                if (!stored) return false;
                const data = JSON.parse(stored);
                // Clean up used challenge
                await kv.delete(`PASSKEY_CHALLENGE:${challenge}`);
                return data.username === user.username && data.type === 'registration';
            },
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Verification failed.', message: err.message }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!verification.verified || !verification.registrationInfo) {
        return new Response(JSON.stringify({ error: 'Registration verification failed.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const { credential } = verification.registrationInfo;

    // Store credential
    const credsJson = await kv.get(`PASSKEY_CREDS:${user.username}`);
    const creds = credsJson ? JSON.parse(credsJson) : [];

    const newCred = {
        credentialId: credential.id,
        publicKey: uint8ArrayToBase64(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || [],
        createdAt: new Date().toISOString(),
        name: body.credentialName || `Passkey ${creds.length + 1}`,
    };

    creds.push(newCred);
    await kv.put(`PASSKEY_CREDS:${user.username}`, JSON.stringify(creds));

    return new Response(JSON.stringify({
        success: true,
        credential: { id: newCred.credentialId, name: newCred.name, createdAt: newCred.createdAt }
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
