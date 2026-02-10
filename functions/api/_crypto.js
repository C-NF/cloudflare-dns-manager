// Shared PBKDF2 helpers for password hashing
// Passwords arrive from the client as SHA-256 hex strings.
// We apply PBKDF2 with a random salt on top before storing.

const ITERATIONS = 100000;

export async function pbkdf2Derive(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a password (already SHA-256 from client) with a new random salt
export async function hashPassword(clientHash) {
    const salt = crypto.randomUUID();
    const derived = await pbkdf2Derive(clientHash, salt);
    return `${salt}:${derived}`;
}

// Verify a client-sent SHA-256 hash against a stored PBKDF2 hash (salt:hash)
export async function verifyPassword(clientHash, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const colonIdx = storedHash.indexOf(':');
    const salt = storedHash.substring(0, colonIdx);
    const hash = storedHash.substring(colonIdx + 1);
    const derived = await pbkdf2Derive(clientHash, salt);
    return derived === hash;
}

// Simple SHA-256 hash (used for hashing env passwords, not for stored credentials)
export async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if stored hash is old legacy format (plain SHA-256, 64 hex chars, no colon)
export function isLegacyHash(storedHash) {
    return storedHash && storedHash.length === 64 && !storedHash.includes(':');
}
