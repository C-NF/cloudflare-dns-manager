export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    const url = new URL(context.request.url);
    const since = url.searchParams.get('since') || '-1440';

    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/analytics/dashboard?since=${since}&until=0&continuous=true`, {
            headers: { ...cfHeaders, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            return new Response(JSON.stringify({
                success: true,
                data: data.result || {},
                errors: []
            }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: false, errors: data.errors || [] }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch analytics' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
