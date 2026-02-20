import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

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
        const [cnameRes, dnssecRes] = await Promise.all([
            cfGet(cfHeaders, zoneId, 'cname_flattening'),
            fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            }).then(r => r.json()).catch(() => ({ success: false, result: {} }))
        ]);

        const settings = {
            cname_flattening: cnameRes.success && cnameRes.result ? cnameRes.result.value : null,
        };

        return new Response(JSON.stringify({
            success: true,
            settings,
            dnssec: dnssecRes.success ? dnssecRes.result : null,
            errors: []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch DNS settings' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        if (setting !== 'cname_flattening') {
            return new Response(JSON.stringify({ success: false, errors: [{ message: `Invalid setting: "${setting}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        try {
            const data = await cfPatch(cfHeaders, zoneId, setting, value);
            if (data.success) {
                await logAudit(kv, username, `dns.${setting}`, `Set ${setting} to ${value} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: `dns.${setting}`, username, detail: `Set ${setting} to ${value} (zone: ${zoneId})` });
            }
            return new Response(JSON.stringify({ success: data.success, result: data.result?.value ?? null, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'enable_dnssec') {
        try {
            // Try PATCH first (works if DNSSEC was previously created/disabled)
            let res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' })
            });
            let data = await res.json();
            // If PATCH fails (e.g. DNSSEC never created), fall back to POST
            if (!data.success) {
                res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                    method: 'POST',
                    headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                data = await res.json();
            }
            if (data.success) {
                await logAudit(kv, username, 'dns.dnssec_enable', `Enabled DNSSEC (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'dns.dnssec_enable', username, detail: `Enabled DNSSEC (zone: ${zoneId})` });
            }
            // Re-fetch current DNSSEC state so badge always reflects truth
            const freshRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const freshData = await freshRes.json();
            const dnssecResult = freshData.success ? freshData.result : (data.result || {});
            return new Response(JSON.stringify({ success: data.success, dnssec: dnssecResult, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'disable_dnssec') {
        try {
            // Use PATCH to disable (more reliable than DELETE)
            let res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'disabled' })
            });
            let data = await res.json();
            // Fall back to DELETE if PATCH doesn't work
            if (!data.success) {
                res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                    method: 'DELETE',
                    headers: { ...cfHeaders, 'Content-Type': 'application/json' }
                });
                data = await res.json();
            }
            if (data.success) {
                await logAudit(kv, username, 'dns.dnssec_disable', `Disabled DNSSEC (zone: ${zoneId})`);
            }
            // Re-fetch to get accurate state
            const freshRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const freshData = await freshRes.json();
            const dnssecResult = freshData.success ? freshData.result : (data.result || { status: 'disabled' });
            return new Response(JSON.stringify({ success: data.success, dnssec: dnssecResult, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
