// DNS Monitors API
// GET    /api/monitors — list all monitors for the user
// POST   /api/monitors — create a new monitor
// DELETE  /api/monitors?id=MONITOR_ID — delete a monitor

const MAX_MONITORS_PER_USER = 50;

export async function onRequestGet(context) {
    const { env } = context;
    const username = context.data.user?.username || 'client';
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const raw = await kv.get(`DNS_MONITORS:${username}`);
    const monitors = raw ? JSON.parse(raw) : [];

    return new Response(JSON.stringify({ success: true, monitors }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const username = context.data.user?.username || 'client';
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const body = await request.json();
    const { zoneId, zoneName, recordType, recordName, expectedContent } = body;

    // Validate required fields
    if (!zoneId || !recordType || !recordName || !expectedContent) {
        return new Response(JSON.stringify({ error: 'Missing required fields: zoneId, recordType, recordName, expectedContent' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Load existing monitors
    const raw = await kv.get(`DNS_MONITORS:${username}`);
    const monitors = raw ? JSON.parse(raw) : [];

    // Enforce limit
    if (monitors.length >= MAX_MONITORS_PER_USER) {
        return new Response(JSON.stringify({ error: `Maximum ${MAX_MONITORS_PER_USER} monitors allowed per user.` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const monitor = {
        id: crypto.randomUUID(),
        zoneId,
        zoneName: zoneName || '',
        recordType: recordType.toUpperCase(),
        recordName,
        expectedContent,
        enabled: true,
        lastCheck: null,
        lastStatus: 'unknown',
        lastError: null,
        createdAt: new Date().toISOString()
    };

    monitors.push(monitor);
    await kv.put(`DNS_MONITORS:${username}`, JSON.stringify(monitors));

    return new Response(JSON.stringify({ success: true, monitor }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestDelete(context) {
    const { env, request } = context;
    const username = context.data.user?.username || 'client';
    const kv = env.CF_DNS_KV;

    if (!kv) {
        return new Response(JSON.stringify({ error: 'KV not configured' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const monitorId = url.searchParams.get('id');

    if (!monitorId) {
        return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const raw = await kv.get(`DNS_MONITORS:${username}`);
    const monitors = raw ? JSON.parse(raw) : [];

    const idx = monitors.findIndex(m => m.id === monitorId);
    if (idx === -1) {
        return new Response(JSON.stringify({ error: 'Monitor not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    monitors.splice(idx, 1);
    await kv.put(`DNS_MONITORS:${username}`, JSON.stringify(monitors));

    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}
