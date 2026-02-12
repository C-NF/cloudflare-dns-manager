import { logAudit } from '../../_audit.js';

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_pages`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return new Response(JSON.stringify({
            success: data.success,
            pages: data.result || [],
            errors: data.errors || []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch custom pages' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const { pageId, url, state } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_pages/${pageId}`, {
                method: 'PUT',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url || '', state: state || 'default' })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'custom_pages.update', `Updated custom page ${pageId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
