export async function onRequestPost(context) {
    const kv = context.env.CF_DNS_KV;
    if (!kv) {
        return new Response(JSON.stringify({ success: true, counts: {} }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const { zoneIds } = await context.request.json();
    if (!Array.isArray(zoneIds) || zoneIds.length === 0) {
        return new Response(JSON.stringify({ success: true, counts: {} }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const counts = {};
    const results = await Promise.all(
        zoneIds.slice(0, 100).map(id =>
            kv.get(`DNS_COUNT:${id}`).then(v => ({ id, count: v })).catch(() => ({ id, count: null }))
        )
    );
    for (const { id, count } of results) {
        if (count !== null) counts[id] = parseInt(count, 10);
    }

    return new Response(JSON.stringify({ success: true, counts }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
