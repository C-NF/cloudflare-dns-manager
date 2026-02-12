import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules?status=active,disabled&order=priority&direction=asc`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return new Response(JSON.stringify({
            success: data.success,
            rules: data.result || [],
            errors: data.errors || []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch page rules' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const { targets, actions: ruleActions, status } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets, actions: ruleActions, status: status || 'active' })
            });
            const data = await res.json();
            if (data.success) {
                const pattern = targets?.[0]?.constraint?.value || '';
                await logAudit(kv, username, 'pagerules.create', `Created page rule for ${pattern} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'pagerules.create', username, detail: `Created page rule for ${pattern}` });
            }
            return new Response(JSON.stringify({ success: data.success, rule: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'update') {
        const { ruleId, targets, actions: ruleActions, status } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules/${ruleId}`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets, actions: ruleActions, status: status || 'active' })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'pagerules.update', `Updated page rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, rule: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'delete') {
        const { ruleId } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules/${ruleId}`, {
                method: 'DELETE',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'pagerules.delete', `Deleted page rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'toggle') {
        const { ruleId, status } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules/${ruleId}`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'pagerules.toggle', `${status === 'active' ? 'Enabled' : 'Disabled'} page rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
