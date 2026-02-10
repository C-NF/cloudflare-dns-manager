// GET: Search DNS records across all zones
export async function onRequestGet(context) {
    const { request } = context;
    const cfToken = context.data.cfToken;
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';

    if (!query || query.length < 2) {
        return new Response(JSON.stringify({ error: 'Search query must be at least 2 characters.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const headers = {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json'
    };

    try {
        // First, get all zones
        const zonesRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', { headers });
        const zonesData = await zonesRes.json();
        if (!zonesData.success) {
            return new Response(JSON.stringify({ error: 'Failed to fetch zones.', results: [] }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        const zones = zonesData.result || [];
        const results = [];

        // Search DNS records in all zones in parallel
        const promises = zones.map(async (zone) => {
            try {
                // Cloudflare API supports name and content search
                const searchRes = await fetch(
                    `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=100&search=${encodeURIComponent(query)}`,
                    { headers }
                );
                const searchData = await searchRes.json();
                if (searchData.success && searchData.result) {
                    return searchData.result.map(r => ({
                        ...r,
                        zoneName: zone.name,
                        zoneId: zone.id
                    }));
                }
            } catch (e) { console.error(`Failed to search DNS records for zone ${zone.name}:`, e); }
            return [];
        });

        const allResults = await Promise.all(promises);
        for (const records of allResults) results.push(...records);

        // Also do client-side filtering for content match (CF search may only match name)
        const lowerQuery = query.toLowerCase();
        const filtered = results.filter(r =>
            r.name.toLowerCase().includes(lowerQuery) ||
            (r.content && r.content.toLowerCase().includes(lowerQuery)) ||
            r.type.toLowerCase().includes(lowerQuery)
        );

        return new Response(JSON.stringify({
            results: filtered.slice(0, 100),
            total: filtered.length,
            zonesSearched: zones.length
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Search failed.', results: [] }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
