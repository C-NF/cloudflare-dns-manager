// Shared validation helpers

// Validate password complexity on the raw password string.
// Since clients send SHA-256 hashes (always 64 hex chars), we can't validate
// the original password server-side. This function is for future use if
// the server ever receives raw passwords, or for other validations.
// For now, password complexity is enforced client-side.

export function validateUsername(username) {
    if (!username || !username.trim()) return 'Username is required.';
    const clean = username.trim().toLowerCase();
    if (clean.length < 2) return 'Username must be at least 2 characters.';
    if (clean.length > 32) return 'Username must be at most 32 characters.';
    if (!/^[a-z0-9_-]+$/.test(clean)) return 'Username must contain only lowercase letters, numbers, hyphens, and underscores.';
    return null;
}
