/**
 * Account and session client.
 *
 * Sign-in creates a PHP session (HttpOnly cookie). The browser never stores a
 * token or a password: every protected request is re-checked against MySQL by
 * the API, so a deactivation, password reset or role change reaches an
 * already-open tab within a minute.
 */

import { useSyncExternalStore } from 'react';
import { api, setCsrfToken } from './api.js';
import { clearStore, hydrateStore, isStoreHydrated } from './store.js';

const listeners = new Set();

let session = null;
let resolved = false;
let bootError = null;

function notify() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getSession() {
    return session;
}

export function getBootError() {
    return bootError;
}

export function useSession() {
    return useSyncExternalStore(subscribe, getSession, getSession);
}

export function useBootError() {
    return useSyncExternalStore(subscribe, getBootError, getBootError);
}

/** False until the first `GET /auth/me` has answered (or failed). */
export function useSessionResolved() {
    return useSyncExternalStore(subscribe, () => resolved, () => resolved);
}

function sessionFromUser(user) {
    return {
        id: user.id,
        stage: 'ready',
        role: user.role,
        // `username` stays the employee code because receipts, stock movements
        // and attendance already use it for attribution.
        username: user.code,
        employeeId: user.code,
        loginUsername: user.username,
        name: user.name,
        email: user.email || '',
        contactNumber: user.contactNumber || '',
        avatar: user.avatar,
        status: user.status,
        must_change_password: Boolean(user.mustChangePassword),
        mustChangePassword: Boolean(user.mustChangePassword),
    };
}

function remember(user) {
    const identityChanged = !session || session.id !== user.id || session.role !== user.role;
    session = sessionFromUser(user);
    resolved = true;
    if (identityChanged) {
        invalidateRoster();
        ensureRosterLoaded();
    }
    notify();
    return session;
}

function forget() {
    session = null;
    resolved = true;
    setCsrfToken('');
    clearStore();
    invalidateRoster();
    notify();
}

/** Sign in with the username, employee ID or (legacy) email. */
export async function signIn(identifier, password) {
    const data = await api('/auth/login', {
        method: 'POST',
        body: { identifier, password },
    });

    setCsrfToken(data.csrfToken);
    const next = remember(data.user);
    if (!next.must_change_password) {
        await hydrateStore(true);
    }
    return next;
}

export function signOut() {
    // Best effort: clear the browser session even when the server is down.
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    forget();
}

/** Replace a temporary password; the server returns the refreshed profile. */
export async function changePassword(currentPassword, newPassword) {
    const data = await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
    });

    setCsrfToken(data.csrfToken);
    const next = remember(data.user);
    await hydrateStore(true);
    return next;
}

let refreshInFlight = null;

/**
 * Re-read the signed-in account (and, on the first call, the whole database)
 * from the API. A deactivated account or reset password therefore logs the
 * open tab out on the next refresh.
 */
export function refreshSession() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = api('/auth/me')
        .then(async ({ user, csrfToken }) => {
            const identityChanged = !session || session.id !== user.id || session.role !== user.role;
            setCsrfToken(csrfToken);
            const next = remember(user);
            if (!next.must_change_password && (identityChanged || !isStoreHydrated())) {
                await hydrateStore(true);
            }
            return getSession();
        })
        .catch((error) => {
            if (error.status === 401 || error.status === 403) {
                forget();
            } else {
                bootError = error;
                resolved = true;
                notify();
            }
            return getSession();
        })
        .finally(() => {
            refreshInFlight = null;
        });

    return refreshInFlight;
}

// ------------------------------------------------------------
// Staff directory (attendance, receipts, reports)
// ------------------------------------------------------------

let rosterCache = [];
let rosterLoaded = false;
let rosterPromise = null;
const rosterListeners = new Set();

function notifyRoster() {
    rosterListeners.forEach((listener) => listener());
}

function invalidateRoster() {
    rosterLoaded = false;
    rosterPromise = null;
    rosterCache = [];
    notifyRoster();
}

function ensureRosterLoaded() {
    if (rosterLoaded || rosterPromise || !session || session.must_change_password) return;
    rosterPromise = api('/employees/directory')
        .then(({ employees }) => {
            rosterCache = Array.isArray(employees) ? employees : [];
            rosterLoaded = true;
            notifyRoster();
        })
        .catch(() => {
            /* Keep the empty roster; a later focus can retry. */
        })
        .finally(() => {
            rosterPromise = null;
        });
}

export function refreshStaffRoster() {
    invalidateRoster();
    ensureRosterLoaded();
}

export function useStaffRoster() {
    return useSyncExternalStore(
        (listener) => {
            rosterListeners.add(listener);
            ensureRosterLoaded();
            return () => rosterListeners.delete(listener);
        },
        () => rosterCache,
        () => rosterCache,
    );
}

// ------------------------------------------------------------
// Admin employee account management
// ------------------------------------------------------------

function queryString(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    const value = params.toString();
    return value ? `?${value}` : '';
}

export async function listStaffAccounts(filters = {}) {
    const data = await api(`/admin/employees${queryString(filters)}`);
    return Array.isArray(data.employees) ? data.employees : [];
}

export async function addStaffAccount(values) {
    const data = await api('/admin/employees', {
        method: 'POST',
        body: {
            fullName: values.fullName,
            employeeId: values.employeeId,
            username: values.username,
            email: values.email || '',
            contactNumber: values.contactNumber || '',
            role: values.role,
            status: values.status,
            password: values.password || '',
        },
    });
    refreshStaffRoster();
    return data;
}

export async function updateStaffAccount(id, values) {
    const data = await api(`/admin/employees/${id}`, {
        method: 'PUT',
        body: {
            fullName: values.fullName,
            employeeId: values.employeeId,
            username: values.username,
            email: values.email || '',
            contactNumber: values.contactNumber || '',
            role: values.role,
            status: values.status,
        },
    });
    refreshStaffRoster();
    return data.account;
}

export async function resetStaffPassword(id) {
    const data = await api(`/admin/employees/${id}/reset-password`, { method: 'POST' });
    return data.temporaryPassword;
}

export async function setStaffStatus(id, status) {
    const data = await api(`/admin/employees/${id}/status`, {
        method: 'PATCH',
        body: { status },
    });
    refreshStaffRoster();
    return data.account;
}

export async function removeStaffAccount(id) {
    const data = await api(`/admin/employees/${id}`, { method: 'DELETE' });
    refreshStaffRoster();
    return data.removed;
}

export async function getAccountAuditLogs() {
    const data = await api('/admin/employees/audit/logs');
    return Array.isArray(data.logs) ? data.logs : [];
}

export { ApiError } from './api.js';
