// DNS Monitors API
// GET    /api/monitors — list all monitors for the user
// POST   /api/monitors — create a new monitor
// DELETE  /api/monitors?id=MONITOR_ID — delete a monitor

const MAX_MONITORS_PER_USER = 50;
const VALID_TYPES = ['dns_record', 'traffic_spike', 'error_rate', 'ssl_expiry'];

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
    const { zoneId, zoneName, monitorType = 'dns_record' } = body;

    if (!zoneId) {
        return new Response(JSON.stringify({ error: 'Missing required field: zoneId' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!VALID_TYPES.includes(monitorType)) {
        return new Response(JSON.stringify({ error: `Invalid monitorType. Allowed: ${VALID_TYPES.join(', ')}` }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    // Validate per type
    if (monitorType === 'dns_record') {
        const { recordType, recordName, expectedContent } = body;
        if (!recordType || !recordName || !expectedContent) {
            return new Response(JSON.stringify({ error: 'DNS Record monitor requires: recordType, recordName, expectedContent' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
    } else if (monitorType === 'traffic_spike') {
        if (!body.threshold || body.threshold < 1) {
            return new Response(JSON.stringify({ error: 'Traffic Spike monitor requires: threshold (positive number)' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
    } else if (monitorType === 'error_rate') {
        if (!body.threshold || body.threshold < 1 || body.threshold > 100) {
            return new Response(JSON.stringify({ error: 'Error Rate monitor requires: threshold (1-100)' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
    } else if (monitorType === 'ssl_expiry') {
        if (!body.daysBeforeExpiry || body.daysBeforeExpiry < 1) {
            return new Response(JSON.stringify({ error: 'SSL Expiry monitor requires: daysBeforeExpiry (positive number)' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const raw = await kv.get(`DNS_MONITORS:${username}`);
    const monitors = raw ? JSON.parse(raw) : [];

    if (monitors.length >= MAX_MONITORS_PER_USER) {
        return new Response(JSON.stringify({ error: `Maximum ${MAX_MONITORS_PER_USER} monitors allowed per user.` }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const monitor = {
        id: crypto.randomUUID(),
        zoneId,
        zoneName: zoneName || '',
        monitorType,
        enabled: true,
        lastCheck: null,
        lastStatus: 'unknown',
        lastError: null,
        createdAt: new Date().toISOString()
    };

    // Add type-specific fields
    if (monitorType === 'dns_record') {
        monitor.recordType = body.recordType.toUpperCase();
        monitor.recordName = body.recordName;
        monitor.expectedContent = body.expectedContent;
    } else if (monitorType === 'traffic_spike') {
        monitor.threshold = body.threshold;
        monitor.timeWindow = body.timeWindow || '1h';
    } else if (monitorType === 'error_rate') {
        monitor.threshold = body.threshold;
        monitor.statusType = body.statusType || '5xx';
    } else if (monitorType === 'ssl_expiry') {
        monitor.daysBeforeExpiry = body.daysBeforeExpiry;
    }

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
