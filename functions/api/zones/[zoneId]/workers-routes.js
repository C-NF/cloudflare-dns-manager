import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return new Response(JSON.stringify({
            success: data.success,
            routes: data.result || [],
            errors: data.errors || []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch workers routes' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    const body = await context.request.json();
    const username = context.data.user?.username || 'client';
    const kv = context.env.CF_DNS_KV;
    const { action } = body;

    if (action === 'create') {
        const { pattern, script } = body;
        try {
            const payload = { pattern };
            if (script) payload.script = script;
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'workers.create_route', `Created workers route ${pattern} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'workers.create_route', username, detail: `Created route ${pattern}` });
            }
            return new Response(JSON.stringify({ success: data.success, route: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'update') {
        const { routeId, pattern, script } = body;
        try {
            const payload = { pattern };
            if (script) payload.script = script;
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${routeId}`, {
                method: 'PUT',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'workers.update_route', `Updated workers route ${pattern} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, route: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'delete') {
        const { routeId } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${routeId}`, {
                method: 'DELETE',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'workers.delete_route', `Deleted workers route ${routeId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
