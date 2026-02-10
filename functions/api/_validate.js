// Shared validation helpers

const VALID_DNS_TYPES = new Set([
    'A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA', 'PTR', 'SPF',
    'LOC', 'NAPTR', 'CERT', 'DNSKEY', 'DS', 'HTTPS', 'SSHFP', 'SVCB', 'TLSA', 'URI'
]);

export function validateDnsRecord(body) {
    const errors = [];
    if (!body.type || !VALID_DNS_TYPES.has(body.type)) {
        errors.push(`Invalid record type: "${body.type || ''}". Must be one of: ${[...VALID_DNS_TYPES].join(', ')}`);
    }
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        errors.push('Record name is required.');
    } else if (body.name.length > 253) {
        errors.push(`Record name exceeds maximum length of 253 characters (got ${body.name.length}).`);
    }
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
        errors.push('Record content is required.');
    } else if (body.content.length > 4096) {
        errors.push(`Record content exceeds maximum length of 4096 characters (got ${body.content.length}).`);
    }
    if (body.ttl !== undefined && body.ttl !== null) {
        const ttl = Number(body.ttl);
        if (!Number.isInteger(ttl) || ttl < 1) {
            errors.push('TTL must be a positive integer (use 1 for automatic).');
        }
    }
    if (body.priority !== undefined && body.priority !== null) {
        const priority = Number(body.priority);
        if (!Number.isInteger(priority) || priority < 0 || priority > 65535) {
            errors.push('Priority must be an integer between 0 and 65535.');
        }
    }
    return errors;
}

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
