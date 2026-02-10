const MAX_AUDIT_ENTRIES = 500;

export async function logAudit(kv, username, action, detail) {
    if (!kv) return;
    try {
        const raw = await kv.get('AUDIT_LOG');
        const log = raw ? JSON.parse(raw) : [];
        log.unshift({
            timestamp: new Date().toISOString(),
            username,
            action,
            detail
        });
        // Cap at MAX_AUDIT_ENTRIES
        if (log.length > MAX_AUDIT_ENTRIES) log.length = MAX_AUDIT_ENTRIES;
        await kv.put('AUDIT_LOG', JSON.stringify(log));
    } catch (e) {
        // Silently fail — audit logging should not break operations
    }
}
