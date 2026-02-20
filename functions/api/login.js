import { SignJWT } from 'jose';
import { sha256, hashPassword, verifyPassword, isLegacyHash } from './_crypto.js';
import { logAudit } from './_audit.js';
import { fireWebhook } from './_webhook.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SEC = 900; // 15 minutes

async function checkLockout(kv, username) {
    if (!kv) return null;
    const raw = await kv.get(`LOGIN_ATTEMPTS:${username}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.count >= MAX_ATTEMPTS) {
        const elapsed = (Date.now() - data.lastAttempt) / 1000;
        if (elapsed < LOCKOUT_SEC) {
            return Math.ceil(LOCKOUT_SEC - elapsed);
        }
        // Lockout expired, reset
        await kv.delete(`LOGIN_ATTEMPTS:${username}`);
        return null;
    }
    return null;
}

async function recordFailedAttempt(kv, username) {
    if (!kv) return;
    const key = `LOGIN_ATTEMPTS:${username}`;
    const raw = await kv.get(key);
    let data = raw ? JSON.parse(raw) : { count: 0 };
    data.count++;
    data.lastAttempt = Date.now();
    await kv.put(key, JSON.stringify(data), { expirationTtl: LOCKOUT_SEC * 2 });
}

async function resetAttempts(kv, username) {
    if (!kv) return;
    await kv.delete(`LOGIN_ATTEMPTS:${username}`);
}

// Lazy migrate old CF_API_TOKEN* keys into USER_TOKENS:admin
async function migrateAdminTokens(env) {
    const kv = env.CF_DNS_KV;
    if (!kv) return [];

    const existing = await kv.get('USER_TOKENS:admin');
    if (existing) return JSON.parse(existing);

    const tokens = [];
    if (env.CF_API_TOKEN) {
        tokens.push({ id: 0, name: 'Default Account', token: env.CF_API_TOKEN });
    }
    let i = 1;
    while (env[`CF_API_TOKEN${i}`]) {
        tokens.push({ id: i, name: `Account ${i}`, token: env[`CF_API_TOKEN${i}`] });
        i++;
    }

    const seen = new Set(tokens.map(t => t.id));
    const kvToken = await kv.get('CF_API_TOKEN');
    if (kvToken && !seen.has(0)) {
        const name = await kv.get('CF_API_TOKEN_NAME') || 'Default Account';
        tokens.push({ id: 0, name, token: kvToken });
    }
    let k = 1;
    while (true) {
        const t = await kv.get(`CF_API_TOKEN${k}`);
        if (!t) break;
        if (!seen.has(k)) {
            const name = await kv.get(`CF_API_TOKEN_NAME${k}`) || `Account ${k}`;
            tokens.push({ id: k, name, token: t });
        }
        k++;
    }

    if (tokens.length > 0) {
        await kv.put('USER_TOKENS:admin', JSON.stringify(tokens));
    }
    return tokens;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const body = await request.json();
    const { username, password } = body;

    const serverPassword = env.APP_PASSWORD;

    if (!serverPassword) {
        return new Response(JSON.stringify({ error: 'Server is not configured for password login.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const loginUsername = username || 'admin';
    const kv = env.CF_DNS_KV;

    // Check account lockout
    const lockoutRemaining = await checkLockout(kv, loginUsername);
    if (lockoutRemaining) {
        return new Response(JSON.stringify({
            error: `Account temporarily locked. Try again in ${Math.ceil(lockoutRemaining / 60)} minute(s).`,
            lockedUntil: lockoutRemaining
        }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': String(lockoutRemaining) }
        });
    }

    let authenticated = false;
    let role = 'user';
    let hasTOTP = false;

    if (loginUsername === 'admin') {
        const serverPasswordHash = await sha256(serverPassword);
        if (password === serverPasswordHash) {
            authenticated = true;
            role = 'admin';
        }
        // Check if admin has TOTP enabled (stored in dedicated key)
        if (kv) {
            const adminTotp = await kv.get('TOTP_SECRET:admin');
            if (adminTotp) hasTOTP = true;
        }
    } else {
        if (kv) {
            const userData = await kv.get(`USER:${loginUsername}`);
            if (userData) {
                const user = JSON.parse(userData);
                if (user.status === 'pending') {
                    return new Response(JSON.stringify({ error: 'Account not set up yet. Please use your setup token to set a password first.', needsSetup: true }), {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                if (isLegacyHash(user.passwordHash)) {
                    if (password === user.passwordHash) {
                        authenticated = true;
                        role = user.role || 'user';
                        // Migrate to PBKDF2
                        user.passwordHash = await hashPassword(password);
                        await kv.put(`USER:${loginUsername}`, JSON.stringify(user));
                    }
                } else {
                    if (await verifyPassword(password, user.passwordHash)) {
                        authenticated = true;
                        role = user.role || 'user';
                    }
                }

                if (user.totpSecret) hasTOTP = true;
            }
        }
    }

    if (!authenticated) {
        await recordFailedAttempt(kv, loginUsername);
        return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Reset failed attempts on success
    await resetAttempts(kv, loginUsername);

    // If user has TOTP enabled, require a second step — do not issue JWT yet
    if (hasTOTP) {
        return new Response(JSON.stringify({ requiresTOTP: true, username: loginUsername }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Generate JWT access token (15 min)
    const secret = new TextEncoder().encode(serverPassword);
    const jti = crypto.randomUUID();
    const jwt = await new SignJWT({ sub: loginUsername, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(secret);

    // Generate refresh token (7 days)
    const refreshToken = await new SignJWT({ sub: loginUsername, role, type: 'refresh', jti })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

    // Load user's accounts
    let accounts = [];

    if (loginUsername === 'admin') {
        const tokens = await migrateAdminTokens(env);
        accounts = tokens.map(t => { const tp = t.type || (t.email ? 'global_key' : 'api_token'); return { id: t.id, name: t.name, type: tp, hint: tp === 'global_key' ? (t.email || '') : (t.token ? '…' + t.token.slice(-4) : '') }; });
    } else if (kv) {
        const tokensJson = await kv.get(`USER_TOKENS:${loginUsername}`);
        if (tokensJson) {
            const tokens = JSON.parse(tokensJson);
            accounts = tokens.map(t => { const tp = t.type || (t.email ? 'global_key' : 'api_token'); return { id: t.id, name: t.name, type: tp, hint: tp === 'global_key' ? (t.email || '') : (t.token ? '…' + t.token.slice(-4) : '') }; });
        }
    }

    await logAudit(kv, loginUsername, 'auth.login', 'Logged in successfully');
    await fireWebhook(kv, {
        type: 'auth.login',
        username: loginUsername,
        detail: 'Logged in successfully'
    });

    return new Response(JSON.stringify({ token: jwt, refreshToken, accounts, role, username: loginUsername }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
