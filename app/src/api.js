/**
 * Small JSON client for the PHP API.
 *
 * Authentication is a PHP session cookie (HttpOnly, SameSite=Lax), so the
 * browser never stores a token. Mutating requests also carry the CSRF token
 * that `/auth/me` and `/auth/login` return.
 */

export class ApiError extends Error {
    constructor(message, status = 0, code = 'REQUEST_FAILED') {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

const base = (import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
// Local XAMPP keeps the same-origin `/guinhawa/api`. A separately hosted PHP
// API is selected with VITE_API_URL (for example https://api.example.com/api),
// so no production URL is invented here.
const API_ROOT = (import.meta.env.VITE_API_URL || `${base}/api`).replace(/\/+$/, '');

// Cross-origin APIs need `credentials: 'include'` for the PHP session cookie.
// Same-origin deployments keep the stricter default, so XAMPP is unchanged.
const API_IS_CROSS_ORIGIN = (() => {
    try {
        return new URL(API_ROOT, window.location.origin).origin !== window.location.origin;
    } catch {
        return false;
    }
})();

let csrfToken = '';

export function setCsrfToken(value) {
    csrfToken = typeof value === 'string' ? value : '';
}

export function apiRoot() {
    return API_ROOT;
}

/**
 * The PHP API returns `{ error: "message", code: "CODE" }`, but static hosts
 * (for example Vercel) return `{ error: { code, message } }`. Pull a readable
 * string out of either shape so the UI never renders `[object Object]`.
 */
function errorMessage(data, fallback) {
    const error = data && typeof data === 'object' ? data.error : null;
    if (typeof error === 'string' && error.trim()) {
        return error;
    }
    if (error && typeof error === 'object') {
        if (typeof error.message === 'string' && error.message.trim()) {
            return error.message;
        }
        if (typeof error.code === 'string' && error.code.trim()) {
            return error.code;
        }
    }
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
        return data.message;
    }
    return fallback;
}

export async function api(path, { method = 'GET', body } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    if (csrfToken && method !== 'GET' && method !== 'HEAD') {
        headers['X-CSRF-Token'] = csrfToken;
    }

    let response;
    try {
        response = await fetch(`${API_ROOT}${path}`, {
            method,
            headers,
            credentials: API_IS_CROSS_ORIGIN ? 'include' : 'same-origin',
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError('Cannot reach the server. Make sure Apache and MySQL are running in XAMPP.', 0, 'NETWORK');
    }

    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {};
        }
    }

    // A static host answering the API route with index.html (or any non-JSON
    // page) means the PHP backend is not reachable at this address. Report that
    // clearly instead of letting the caller fail on a missing field.
    const contentType = response.headers.get('content-type') || '';
    if (text && !contentType.includes('application/json')) {
        throw new ApiError(
            response.status === 404
                ? `The PHP API was not found at ${API_ROOT}. Host the backend separately and set VITE_API_URL to its URL.`
                : `The API at ${API_ROOT} did not return JSON. Make sure the PHP backend is hosted and VITE_API_URL points at it.`,
            response.status,
            'API_MISCONFIGURED',
        );
    }

    if (!response.ok) {
        // A 404 whose `error` is an object is a static host (Vercel) saying
        // "no such route", not the PHP API rejecting a request. PHP always
        // returns `error` as a string.
        const staticHost404 = response.status === 404
            && data && typeof data === 'object'
            && data.error && typeof data.error === 'object';

        if (staticHost404) {
            throw new ApiError(
                `The PHP API was not found at ${API_ROOT}. Host the backend separately and set VITE_API_URL to its URL.`,
                response.status,
                'API_MISCONFIGURED',
            );
        }

        throw new ApiError(
            errorMessage(data, `The server could not complete that request (${response.status}).`),
            response.status,
            (data && typeof data === 'object' && typeof data.code === 'string' && data.code) || 'REQUEST_FAILED',
        );
    }

    return data;
}
