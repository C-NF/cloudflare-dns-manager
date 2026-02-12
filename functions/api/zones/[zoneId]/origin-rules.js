import { logAudit } from '../../_audit.js';

export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_origin/entrypoint`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            return new Response(JSON.stringify({
                success: true,
                rules: data.result?.rules || [],
                rulesetId: data.result?.id || null,
                errors: []
            }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (!data.success && data.errors?.some(e => e.code === 10000 || e.message?.includes('not found'))) {
            return new Response(JSON.stringify({ success: true, rules: [], rulesetId: null, errors: [] }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: false, errors: data.errors || [] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch origin rules' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
        const { ruleIndex, enabled } = body;
        try {
            const getRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/http_request_origin/entrypoint`, {
                headers: { ...cfHeaders, 'Content-Type': 'application/json' }
            });
            const getData = await getRes.json();
            if (!getData.success || !getData.result) {
                return new Response(JSON.stringify({ success: false, errors: [{ message: 'Could not fetch ruleset' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const ruleset = getData.result;
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
                await logAudit(kv, username, 'origin.toggle', `${enabled ? 'Enabled' : 'Disabled'} origin rule #${ruleIndex + 1} (zone: ${zoneId})`);
            }
            return new Response(JSON.stringify({ success: putData.success, errors: putData.errors || [] }), { status: putData.success ? 200 : 400, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: e.message }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    return new Response(JSON.stringify({ success: false, errors: [{ message: `Unknown action: "${action}"` }] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}
