// Zone-based access control helpers

/**
 * Get the allowedZones array for a user from KV.
 * Returns [] (empty array = all zones) if not set or user is admin.
 */
export async function getUserAllowedZones(kv, username) {
    if (!kv || !username || username === 'admin') {
        return [];
    }

    try {
        const dataJson = await kv.get(`USER:${username}`);
        if (!dataJson) return [];

        const userData = JSON.parse(dataJson);
        return Array.isArray(userData.allowedZones) ? userData.allowedZones : [];
    } catch (e) {
        console.error('Failed to get user allowed zones:', e);
        return [];
    }
}

/**
 * Check if a zone name is allowed for the user.
 * If allowedZones is empty, all zones are allowed (backward compatible).
 * Zone names are compared case-insensitively.
 */
export function isZoneAllowed(allowedZones, zoneName) {
    if (!Array.isArray(allowedZones) || allowedZones.length === 0) {
        return true;
    }
    const lowerZoneName = zoneName.toLowerCase();
    return allowedZones.some(z => z.toLowerCase() === lowerZoneName);
}
