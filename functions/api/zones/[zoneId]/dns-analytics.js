export async function onRequestGet(context) {
    const { cfHeaders } = context.data;
    const { zoneId } = context.params;
    const url = new URL(context.request.url);
    const sinceMinutes = parseInt(url.searchParams.get('since') || '-1440');

    // Convert relative minutes to ISO 8601 timestamps
    const now = new Date();
    const sinceDate = new Date(now.getTime() + sinceMinutes * 60 * 1000);
    const sinceISO = sinceDate.toISOString();
    const untilISO = now.toISOString();

    try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_analytics/report?dimensions=queryType,responseCode&since=${sinceISO}&until=${untilISO}`, {
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
        return new Response(JSON.stringify({ success: false, errors: [{ message: e.message || 'Failed to fetch DNS analytics' }] }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
