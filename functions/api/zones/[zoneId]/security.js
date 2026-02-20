import { logAudit } from '../../_audit.js';
import { fireWebhook } from '../../_webhook.js';

const SECURITY_SETTINGS = ['security_level', 'challenge_ttl', 'browser_check', 'privacy_pass', 'bot_fight_mode'];

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
        const [settingsResults, fwRes] = await Promise.all([
            Promise.all(SECURITY_SETTINGS.map(s => cfGet(cfHeaders, zoneId, s))),
            fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules?per_page=50`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            }).then(r => r.json()).catch(() => ({ success: false, result: [] }))
        ]);

        const settings = {};
        SECURITY_SETTINGS.forEach((key, i) => {
            const data = settingsResults[i];
            settings[key] = data.success && data.result ? data.result.value : null;
        });

        return new Response(JSON.stringify({
            success: true,
            settings,
            firewall_rules: fwRes.success ? fwRes.result : [],
            errors: []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch security settings' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        if (!SECURITY_SETTINGS.includes(setting)) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: `Invalid setting: "${setting}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        try {
            const data = await cfPatch(cfHeaders, zoneId, setting, value);
            if (data.success) {
                await logAudit(kv, username, `security.${setting}`, `Set ${setting} to ${value} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: `security.${setting}`, username, detail: `Set ${setting} to ${value} (zone: ${zoneId})` });
            }
            return new Response(JSON.stringify({ success: data.success, result: data.result?.value ?? null, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || `Failed to update ${setting}` }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'toggle_firewall_rule') {
        const { ruleId, paused } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules/${ruleId}`, {
                method: 'PATCH',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ paused })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'security.firewall_rule', `${paused ? 'Paused' : 'Enabled'} firewall rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'create_firewall_rule') {
        const { description, expression, ruleAction, priority, paused } = body;
        if (!expression || !ruleAction) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: 'Expression and action are required' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        try {
            const filterRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/filters`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify([{ expression }])
            });
            const filterData = await filterRes.json();
            if (!filterData.success) {
                return new Response(JSON.stringify({ success: false, errors: filterData.errors || [{ message: 'Failed to create filter' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const filterId = filterData.result[0].id;
            const ruleRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`, {
                method: 'POST',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify([{ description: description || '', action: ruleAction, filter: { id: filterId }, priority: priority || 1, paused: paused || false }])
            });
            const ruleData = await ruleRes.json();
            if (ruleData.success) {
                await logAudit(kv, username, 'security.create_firewall_rule', `Created firewall rule "${description}" (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'security.create_firewall_rule', username, detail: `Created firewall rule "${description}"` });
            }
            return new Response(JSON.stringify({ success: ruleData.success, rule: ruleData.result?.[0], errors: ruleData.errors || [] }), { status: ruleData.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'update_firewall_rule') {
        const { ruleId, filterId, description, expression, ruleAction, priority, paused } = body;
        try {
            if (expression && filterId) {
                await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/filters/${filterId}`, {
                    method: 'PUT',
                    headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: filterId, expression })
                });
            }
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules/${ruleId}`, {
                method: 'PUT',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ruleId, description: description || '', action: ruleAction, filter: { id: filterId }, priority: priority || 1, paused: paused || false })
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'security.update_firewall_rule', `Updated firewall rule ${ruleId} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    if (action === 'delete_firewall_rule') {
        const { ruleId } = body;
        try {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules/${ruleId}`, {
                method: 'DELETE',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                await logAudit(kv, username, 'security.delete_firewall_rule', `Deleted firewall rule ${ruleId} (zone: ${zoneId})`);
                await fireWebhook(kv, { type: 'security.delete_firewall_rule', username, detail: `Deleted firewall rule ${ruleId}` });
            }
            return new Response(JSON.stringify({ success: data.success, errors: data.errors || [] }), { status: data.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
