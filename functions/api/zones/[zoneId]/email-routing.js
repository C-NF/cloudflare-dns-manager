import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const [rulesRes, settingsRes] = await Promise.all([
            fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            }).then(r => r.json()).catch(() => ({ success: false, result: [] })),
            fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            }).then(r => r.json()).catch(() => ({ success: false, result: {} }))
        ]);

        return new Response(JSON.stringify({
            success: true,
            rules: rulesRes.success ? rulesRes.result : [],
            enabled: settingsRes.result?.enabled || false,
            errors: []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch email routing' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const { matchers, actions, enabled } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchers, actions, enabled: enabled !== false })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'email.create_rule', `Created email routing rule (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'email.create_rule', username, detail: `Created email routing rule` });
            }
            return new Response(JSON.stringify({ success: data.success, rule: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'update') {
        const { ruleId, matchers, actions, enabled } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/${ruleId}`, {
                method: 'PUT',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchers, actions, enabled: enabled !== false })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'email.update_rule', `Updated email routing rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, rule: data.result, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'delete') {
        const { ruleId } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/${ruleId}`, {
                method: 'DELETE',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'email.delete_rule', `Deleted email routing rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'enable_routing' || action === 'disable_routing') {
        const enable = action === 'enable_routing';
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/${enable ? 'enable' : 'disable'}`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, `email.${action}`, `${enable ? 'Enabled' : 'Disabled'} email routing (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
