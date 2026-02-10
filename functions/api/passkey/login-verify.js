// POST /api/passkey/login-verify — verify WebAuthn authentication response, issue JWT
// No authentication required.

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { SignJWT } from 'jose';
import { logAudit } from '../_audit.js';

function base64ToUint8Array(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const kv = env.CF_DNS_KV;
    const serverPassword = env.APP_PASSWORD;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!serverPassword) {
        return new Response(JSON.stringify({ error: 'Server not configured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await request.json();
    const url = new URL(request.url);
    const rpID = url.hostname;
    const origin = url.origin;

    // Find the challenge and associated username
    let challengeUsername = null;

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: async (challenge) => {
                const stored = await kv.get(`PASSKEY_CHALLENGE:${challenge}`);
                if (!stored) return false;
                const data = JSON.parse(stored);
                if (data.type !== 'authentication') return false;
                challengeUsername = data.username;
                await kv.delete(`PASSKEY_CHALLENGE:${challenge}`);
                return true;
            },
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: await (async () => {
                // We need to find the credential. The response.id tells us which credential was used.
                // But we don't know the username yet at this point in the flow...
                // We'll use a two-pass approach: first find the challenge to get the username,
                // then find the credential.
                // Actually, the expectedChallenge callback runs first, so we use body.response
                // to extract the challenge from clientDataJSON.
                // Let's decode clientDataJSON to get the challenge first.
                const clientDataB64 = body.response.clientDataJSON;
                const clientDataJson = atob(clientDataB64.replace(/-/g, '+').replace(/_/g, '/'));
                const clientData = JSON.parse(clientDataJson);
                const challenge = clientData.challenge;

                const stored = await kv.get(`PASSKEY_CHALLENGE:${challenge}`);
                if (!stored) throw new Error('Challenge not found or expired.');
                const data = JSON.parse(stored);
                challengeUsername = data.username;

                // Load user's credentials
                const credsJson = await kv.get(`PASSKEY_CREDS:${challengeUsername}`);
                const creds = credsJson ? JSON.parse(credsJson) : [];

                const matching = creds.find(c => c.credentialId === body.id);
                if (!matching) throw new Error('Credential not found.');

                return {
                    id: matching.credentialId,
                    publicKey: base64ToUint8Array(matching.publicKey),
                    counter: matching.counter,
                    transports: matching.transports || [],
                };
            })(),
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Authentication failed.', message: err.message }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!verification.verified) {
        return new Response(JSON.stringify({ error: 'Passkey verification failed.' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    // Update credential counter
    const credsJson = await kv.get(`PASSKEY_CREDS:${challengeUsername}`);
    const creds = credsJson ? JSON.parse(credsJson) : [];
    const credIdx = creds.findIndex(c => c.credentialId === body.id);
    if (credIdx >= 0) {
        creds[credIdx].counter = verification.authenticationInfo.newCounter;
        await kv.put(`PASSKEY_CREDS:${challengeUsername}`, JSON.stringify(creds));
    }

    // Determine role
    let role = 'user';
    if (challengeUsername === 'admin') {
        role = 'admin';
    } else {
        const userDataJson = await kv.get(`USER:${challengeUsername}`);
        if (userDataJson) {
            const userData = JSON.parse(userDataJson);
            role = userData.role || 'user';
        }
    }

    // Generate JWT access token (15 min)
    const secret = new TextEncoder().encode(serverPassword);
    const jti = crypto.randomUUID();
    const jwt = await new SignJWT({ sub: challengeUsername, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(secret);

    // Generate refresh token (7 days)
    const refreshToken = await new SignJWT({ sub: challengeUsername, role, type: 'refresh', jti })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

    // Load accounts
    let accounts = [];
    if (challengeUsername === 'admin') {
        const tokensJson = await kv.get('USER_TOKENS:admin');
        if (tokensJson) {
            accounts = JSON.parse(tokensJson).map(t => ({ id: t.id, name: t.name }));
        }
    } else {
        const tokensJson = await kv.get(`USER_TOKENS:${challengeUsername}`);
        if (tokensJson) {
            accounts = JSON.parse(tokensJson).map(t => ({ id: t.id, name: t.name }));
        }
    }

    await logAudit(kv, challengeUsername, 'auth.passkey_login', 'Logged in via passkey');

    return new Response(JSON.stringify({
        token: jwt, refreshToken, accounts, role, username: challengeUsername
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
