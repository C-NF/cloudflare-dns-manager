export const getAuthHeaders = (auth, withType = false) => {
    if (!auth) return {};

    // Check if the current account's token is stored locally
    if (auth.mode === 'server') {
        const localTokens = JSON.parse(localStorage.getItem('local_cf_tokens') || '{}');
        const localKey = `${auth.username || 'admin'}_${auth.currentAccountIndex || 0}`;
        if (localTokens[localKey]) {
            const h = { 'X-Cloudflare-Token': localTokens[localKey] };
            if (withType) h['Content-Type'] = 'application/json';
            return h;
        }
    }

    const h = auth.mode === 'server'
        ? {
            'Authorization': `Bearer ${auth.token}`,
            'X-Managed-Account-Index': String(auth.currentAccountIndex || 0)
        }
        : { 'X-Cloudflare-Token': auth.token };
    if (withType) h['Content-Type'] = 'application/json';
    return h;
};

export const hashPassword = async (pwd) => {
    const msgUint8 = new TextEncoder().encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const isPasswordStrong = (pwd) => pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);
