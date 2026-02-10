/**
 * Centralized API client for cf-dns-manager.
 *
 * Provides a thin fetch wrapper that:
 *   - Auto-attaches auth headers from the current auth state
 *   - Auto-sets Content-Type: application/json
 *   - On 401 response, attempts one token refresh then retries
 *   - Parses JSON responses automatically
 *   - Throws typed ApiError for error responses
 *   - Supports abort signals
 */

export class ApiError extends Error {
    /**
     * @param {number} status   - HTTP status code
     * @param {string} message  - Human-readable error message
     * @param {*}      [data]   - Optional parsed response body
     */
    constructor(status, message, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

export class ApiClient {
    /**
     * @param {() => import('../types').AuthState | null} getAuth
     *        Returns the current auth state.
     * @param {((auth: import('../types').AuthState) => Promise<import('../types').AuthState | null>) | null} onRefreshToken
     *        Called when a 401 is received.  Should attempt a token refresh and
     *        return the updated auth state, or null on failure.
     */
    constructor(getAuth, onRefreshToken = null) {
        this._getAuth = getAuth;
        this._onRefreshToken = onRefreshToken;
    }

    // ------------------------------------------------------------------ //
    //  Convenience verbs                                                   //
    // ------------------------------------------------------------------ //

    /**
     * @param {string} url
     * @param {RequestInit} [options]
     */
    async get(url, options) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * @param {string} url
     * @param {*}      body
     * @param {RequestInit} [options]
     */
    async post(url, body, options) {
        return this.request(url, { ...options, method: 'POST', body: JSON.stringify(body) });
    }

    /**
     * @param {string} url
     * @param {*}      body
     * @param {RequestInit} [options]
     */
    async put(url, body, options) {
        return this.request(url, { ...options, method: 'PUT', body: JSON.stringify(body) });
    }

    /**
     * @param {string} url
     * @param {*}      body
     * @param {RequestInit} [options]
     */
    async patch(url, body, options) {
        return this.request(url, { ...options, method: 'PATCH', body: JSON.stringify(body) });
    }

    /**
     * @param {string} url
     * @param {RequestInit} [options]
     */
    async del(url, options) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    // ------------------------------------------------------------------ //
    //  Core request method                                                 //
    // ------------------------------------------------------------------ //

    /**
     * @param {string}      url
     * @param {RequestInit} [options]
     * @returns {Promise<*>} Parsed JSON response body.
     */
    async request(url, options = {}) {
        const doFetch = async (authOverride) => {
            const auth = authOverride || this._getAuth();
            const headers = new Headers(options.headers || {});

            // Auto-set Content-Type when not already present and there is a body
            if (!headers.has('Content-Type') && options.body != null) {
                headers.set('Content-Type', 'application/json');
            }

            // Auto-attach auth headers
            if (auth) {
                if (auth._localToken) {
                    headers.set('X-Cloudflare-Token', auth._localToken);
                } else if (auth.mode === 'server') {
                    headers.set('Authorization', `Bearer ${auth.token}`);
                    headers.set('X-Managed-Account-Index', String(auth.currentAccountIndex || 0));
                } else {
                    headers.set('X-Cloudflare-Token', auth.token);
                }
            }

            const fetchOptions = {
                ...options,
                headers,
            };

            // Forward abort signal if provided
            if (options.signal) {
                fetchOptions.signal = options.signal;
            }

            return fetch(url, fetchOptions);
        };

        // First attempt
        let res = await doFetch();

        // On 401, try refreshing the token once then retry
        if (res.status === 401 && this._onRefreshToken) {
            const auth = this._getAuth();
            if (auth) {
                const refreshed = await this._onRefreshToken(auth);
                if (refreshed) {
                    res = await doFetch(refreshed);
                }
            }
        }

        // Parse response body
        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await res.json();
        } else {
            // Attempt JSON parse; fall back to text
            const text = await res.text();
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        if (!res.ok) {
            const message =
                (data && (data.error || data.message)) ||
                `Request failed with status ${res.status}`;
            throw new ApiError(res.status, message, data);
        }

        return data;
    }
}

/**
 * Creates an ApiClient instance wired to the given auth accessors.
 *
 * Usage (inside a React component / hook):
 *
 *   const apiRef = useRef(null);
 *   if (!apiRef.current) {
 *       apiRef.current = createApiClient(() => authRef.current, tryRefresh);
 *   }
 *   const api = apiRef.current;
 *   const data = await api.get('/api/zones');
 *
 * @param {() => import('../types').AuthState | null} getAuth
 * @param {((auth: import('../types').AuthState) => Promise<import('../types').AuthState | null>) | null} onRefreshToken
 * @returns {ApiClient}
 */
export function createApiClient(getAuth, onRefreshToken = null) {
    return new ApiClient(getAuth, onRefreshToken);
}
