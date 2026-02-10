// GET: Paginated audit log (admin only, enforced by middleware)
export async function onRequestGet(context) {
    const { env } = context;
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 100);

    const raw = await kv.get('AUDIT_LOG');
    const log = raw ? JSON.parse(raw) : [];

    const total = log.length;
    const start = (page - 1) * perPage;
    const entries = log.slice(start, start + perPage);

    return new Response(JSON.stringify({
        entries,
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage)
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// DELETE: Clear audit log
export async function onRequestDelete(context) {
    const { env } = context;
    const kv = env.CF_DNS_KV;
    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
    await kv.put('AUDIT_LOG', JSON.stringify([]));
    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
