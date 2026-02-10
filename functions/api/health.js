export async function onRequestGet(context) {
    const { env } = context;
    const version = env.APP_VERSION || '26.2.7';
    const timestamp = new Date().toISOString();

    let kvHealthy = true;

    if (env.CF_DNS_KV) {
        try {
            await env.CF_DNS_KV.get('HEALTH_CHECK');
        } catch {
            kvHealthy = false;
        }
    } else {
        kvHealthy = false;
    }

    const status = kvHealthy ? 'ok' : 'degraded';
    const httpStatus = kvHealthy ? 200 : 503;

    return new Response(JSON.stringify({
        status,
        timestamp,
        version,
        kv: kvHealthy,
    }), {
        status: httpStatus,
        headers: { 'Content-Type': 'application/json' },
    });
}
