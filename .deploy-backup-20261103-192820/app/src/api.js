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
const API_ROOT = import.meta.env.VITE_API_URL || `${base}/api`;

let csrfToken = '';

export function setCsrfToken(value) {
    csrfToken = typeof value === 'string' ? value : '';
}

export function apiRoot() {
    return API_ROOT;
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
            credentials: 'same-origin',
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

    if (!response.ok) {
        throw new ApiError(
            data.error || `The server could not complete that request (${response.status}).`,
            response.status,
            data.code || 'REQUEST_FAILED',
        );
    }

    return data;
}
