import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

const NETWORK_SETTINGS = ['websockets', 'ip_geolocation', 'ipv6', 'pseudo_ipv4', 'opportunistic_onion', 'http3', 'true_client_ip_header', 'max_upload'];

async function cfGet(cfHeaders, zoneId, setting) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${setting}`, {
        headers: { ...cfHeaders, 'Content-Type': 'application/json' }
    });
    return res.json();
}

async function cfPatch(cfHeaders, zoneId, setting, value) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/${setting}`, {
        method: 'PATCH',
        headers: { ...cfHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    });
    return res.json();
}

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const results = await Promise.all(NETWORK_SETTINGS.map(s => cfGet(cfHeaders, zoneId, s)));
        const settings = {};
        NETWORK_SETTINGS.forEach((key, i) => {
            const data = results[i];
            settings[key] = data.success && data.result ? data.result.value : null;
        });
        return new Response(JSON.stringify({ success: true, settings, errors: [] }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch network settings' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    const body = await context.request.json();
    const username = context.data.user?.username || 'client';
    const kv = context.env.CF_DNS_KV;
    const { action } = body;

    if (action === 'update') {
        const { setting, value } = body;
        if (!NETWORK_SETTINGS.includes(setting)) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: `Invalid setting: "${setting}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        try {
            const data = await cfPatch(cfHeaders, zoneId, setting, value);
            if (data.success) {
                const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
                await logAudit(kv, username, `network.${setting}`, `Set ${setting} to ${valueStr} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: `network.${setting}`, username, detail: `Set ${setting} to ${valueStr} (zone: ${zoneId})` });
            }
            return new Response(JSON.stringify({ success: data.success, result: data.result?.value ?? null, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || `Failed to update ${setting}` }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
