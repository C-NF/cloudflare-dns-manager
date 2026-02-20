import { logAudit } from './_audit.js';
import { fireWebhook } from './_webhook.js';

const ALLOWED_SETTINGS = [
    'security_level', 'ssl', 'always_use_https', 'min_tls_version',
    'http3', 'ipv6', 'websockets', 'email_obfuscation',
    'server_side_exclude', 'hotlink_protection', 'browser_check',
    'bot_fight_mode', 'privacy_pass'
];

export async function onRequestPost(context) {
    const { cfHeaders } = context.data;
    const body = await context.request.json();
    const username = context.data.user?.username || 'client';
    const kv = context.env.CF_DNS_KV;
    const { zones, setting, value } = body;

    if (!setting || !ALLOWED_SETTINGS.includes(setting)) {
        return new Response(JSON.stringify({ success: false, error: `Invalid setting: "${setting}". Allowed: ${ALLOWED_SETTINGS.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (value === undefined || value === null) {
        return new Response(JSON.stringify({ success: false, error: 'Value is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Resolve zones
    let targetZones = [];
    try {
        if (zones === 'all') {
            let page = 1;
            while (true) {
                const res = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}`, {
                    headers: { ...cfHeaders, 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (!data.success || !data.result?.length) break;
                targetZones.push(...data.result.map(z => ({ id: z.id, name: z.name })));
                if (data.result.length < 50) break;
                page++;
            }
        } else if (Array.isArray(zones)) {
            targetZones = zones.map(id => ({ id, name: id }));
        } else {
            return new Response(JSON.stringify({ success: false, error: 'zones must be "all" or an array of zone IDs' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
    } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to resolve zones: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (targetZones.length === 0) {
        return new Response(JSON.stringify({ success: true, results: [] }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Apply setting to each zone
    const results = await Promise.all(targetZones.map(async (zone) => {
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/settings/${setting}`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
            const data = await res.json();
            return { zoneId: zone.id, zoneName: zone.name, success: data.success, count: data.success ? 1 : 0, errors: data.errors?.map(e => e.message) || [] };
        } catch (e) {
            return { zoneId: zone.id, zoneName: zone.name, success: false, count: 0, errors: [e.message] };
        }
    }));

    const successCount = results.filter(r => r.success).length;
    await logAudit(kv, username, 'bulk.apply_setting', `Applied ${setting}=${value} to ${successCount}/${targetZones.length} zones`);
    await fireWebhook(kv, { type: 'bulk.apply_setting', username, detail: `Applied ${setting}=${value} to ${successCount}/${targetZones.length} zones` });

    return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' } });
}
