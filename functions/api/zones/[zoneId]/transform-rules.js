import { logAudit } from '../../_audit.js';

async function fetchRuleset(cfHeaders, zoneId, phase) {
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) return data.result;
        return null;
    } catch {
        return null;
    }
}

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const [urlRewrite, headerMod] = await Promise.all([
            fetchRuleset(cfHeaders, zoneId, 'http_request_transform'),
            fetchRuleset(cfHeaders, zoneId, 'http_request_late_transform'),
        ]);

        return new Response(JSON.stringify({
            success: true,
            url_rewrite_rules: urlRewrite?.rules || [],
            url_rewrite_ruleset_id: urlRewrite?.id || null,
            header_mod_rules: headerMod?.rules || [],
            header_mod_ruleset_id: headerMod?.id || null,
            errors: []
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch transform rules' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

export async function onRequestPost(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    const body = await context.request.json();
    const username = context.data.user?.username || 'client';
    const kv = context.env.CF_DNS_KV;
    const { action } = body;

    if (action === 'toggle_rule') {
        const { phase, ruleIndex, enabled } = body;
        const cfPhase = phase === 'url_rewrite' ? 'http_request_transform' : 'http_request_late_transform';
        try {
            const ruleset = await fetchRuleset(cfHeaders, zoneId, cfPhase);
            if (!ruleset) {
                return new Response(JSON.stringify({ success: false, errors: [{ message: 'Could not fetch ruleset' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const rules = ruleset.rules || [];
            if (ruleIndex < 0 || ruleIndex >= rules.length) {
                return new Response(JSON.stringify({ success: false, errors: [{ message: 'Invalid rule index' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            rules[ruleIndex] = { ...rules[ruleIndex], enabled };

            const putRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${ruleset.id}`, {
                method: 'PUT',
                headers: { ...cfHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules })
            });
            const putData = await putRes.json();
            if (putData.success) {
                await logAudit(kv, username, 'transform.toggle', `${enabled ? 'Enabled' : 'Disabled'} ${phase} rule #${ruleIndex + 1} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: putData.success, errors: putData.errors || [] }), { status: putData.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
