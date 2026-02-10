// GET /api/passkey/credentials — list user's passkeys
// DELETE /api/passkey/credentials?id=... — delete a passkey
// Requires authentication (JWT).

export async function onRequestGet(context) {
    const { env } = context;
    const kv = env.CF_DNS_KV;
    const user = context.data.user;

    if (!kv || !user || !user.username) {
        return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    const credsJson = await kv.get(`PASSKEY_CREDS:${user.username}`);
    const creds = credsJson ? JSON.parse(credsJson) : [];

    // Return only safe fields (no publicKey)
    const safeList = creds.map(c => ({
        id: c.credentialId,
        name: c.name || 'Passkey',
        createdAt: c.createdAt,
    }));

    return new Response(JSON.stringify({ credentials: safeList }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const kv = env.CF_DNS_KV;
    const user = context.data.user;

    if (!kv || !user || !user.username) {
        return new Response(JSON.stringify({ error: 'Authentication required.' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const credId = url.searchParams.get('id');

    if (!credId) {
        return new Response(JSON.stringify({ error: 'Credential ID is required.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const credsJson = await kv.get(`PASSKEY_CREDS:${user.username}`);
    let creds = credsJson ? JSON.parse(credsJson) : [];

    const before = creds.length;
    creds = creds.filter(c => c.credentialId !== credId);

    if (creds.length === before) {
        return new Response(JSON.stringify({ error: 'Credential not found.' }), {
            status: 404, headers: { 'Content-Type': 'application/json' }
        });
    }

    await kv.put(`PASSKEY_CREDS:${user.username}`, JSON.stringify(creds));

    return new Response(JSON.stringify({ success: true, remaining: creds.length }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
