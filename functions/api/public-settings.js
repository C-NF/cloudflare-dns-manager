// Public settings endpoint — no auth required.
// Returns non-sensitive app settings needed by the login page.

export async function onRequestGet(context) {
    const { env } = context;
    const kv = env.CF_DNS_KV;

    const defaults = { openRegistration: false };

    if (!kv) {
        return new Response(JSON.stringify(defaults), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const raw = await kv.get('APP_SETTINGS');
    const settings = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;

    // Only expose safe public fields
    return new Response(JSON.stringify({ openRegistration: settings.openRegistration }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
