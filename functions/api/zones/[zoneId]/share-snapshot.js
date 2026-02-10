// POST: Create a shareable read-only snapshot link
// GET with ?token=TOKEN: Return the shared snapshot data (no auth required)

function generateToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
    const kv = context.env.CF_DNS_KV;
    const url = new URL(context.request.url);
    const token = url.searchParams.get('token');

    if (!token) {
        return new Response(JSON.stringify({ error: 'Token parameter is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const key = `SHARED_SNAPSHOT:${token}`;
    const raw = await kv.get(key);
    if (!raw) {
        return new Response(JSON.stringify({ error: 'Shared snapshot not found or expired.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const data = JSON.parse(raw);
    return new Response(JSON.stringify({ snapshot: data }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestPost(context) {
    const { cfToken } = context.data;
    const { zoneId } = context.params;
    const kv = context.env.CF_DNS_KV;
    const username = context.data.user?.username || 'client';

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV storage not configured.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await context.request.json();
    const { snapshotKey } = body;

    if (!snapshotKey) {
        return new Response(JSON.stringify({ error: 'snapshotKey is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Fetch the snapshot data
    const raw = await kv.get(snapshotKey);
    if (!raw) {
        return new Response(JSON.stringify({ error: 'Snapshot not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const snapshot = JSON.parse(raw);

    // Generate share token and store with 7-day TTL
    const token = generateToken();
    const TTL_7_DAYS = 7 * 24 * 60 * 60;
    const shareData = {
        zoneId,
        timestamp: snapshot.timestamp,
        username: snapshot.username,
        action: snapshot.action,
        records: snapshot.records || [],
        sharedBy: username,
        sharedAt: new Date().toISOString()
    };

    await kv.put(`SHARED_SNAPSHOT:${token}`, JSON.stringify(shareData), { expirationTtl: TTL_7_DAYS });

    const baseUrl = new URL(context.request.url);
    const shareUrl = `${baseUrl.origin}/api/zones/${zoneId}/share-snapshot?token=${token}`;

    return new Response(JSON.stringify({ success: true, token, shareUrl }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
