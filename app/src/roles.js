/**
 * The roles and the pages each one may open. Mirrors the old PHP
 * PAGE_ACCESS map so a URL typed by hand lands on the same access denied page
 * as before.
 */

export const ROLES = [
    {
        key: 'admin',
        short: 'ADMIN',
        title: 'System Administrator',
        label: 'Admin',
        home: '/admin/dashboard',
        icon: 'bi-person-gear',
        accent: 'admin',
    },
    {
        key: 'counter-staff',
        short: 'COUNTER',
        title: 'Counter Staff',
        label: 'Counter Staff',
        home: '/counter-staff/overview',
        icon: 'bi-person-workspace',
        accent: 'counter',
    },
    {
        key: 'inventory-staff',
        short: 'INVENTORY',
        title: 'Inventory Staff',
        label: 'Inventory Staff',
        home: '/inventory-staff/overview',
        icon: 'bi-boxes',
        accent: 'inventory',
    },
];

/** The single sign-in page; every account opens its own workspace from here. */
export const LOGIN_URL = '/';

/** Employees with a temporary password must finish here before any panel. */
export const CHANGE_PASSWORD_URL = '/change-password';

export const PAGE_ACCESS = {
    admin: [
        '/dashboard', '/products', '/inventory', '/stock-in', '/stock-out',
        '/history', '/customers', '/staff', '/orders', '/sales', '/receipts', '/receipt', '/settings',
        '/pos', '/sales-history', '/attendance', '/low-stock', '/expiration', '/damaged-expired', '/suppliers', '/reports', '/audit-logs',
    ],
    'counter-staff': [
        '/overview', '/available-stocks', '/pos', '/sales-history', '/attendance', '/receipt',
    ],
    'inventory-staff': [
        '/overview', '/products', '/inventory', '/stock-in', '/stock-out', '/history',
        '/attendance', '/low-stock', '/expiration', '/damaged-expired', '/suppliers',
    ],
};

export function roleByKey(key) {
    if (key === 'staff') key = 'counter-staff';
    return ROLES.find((role) => role.key === key) || null;
}

export function canAccess(role, path) {
    if (role === 'staff') role = 'counter-staff';
    const allowed = PAGE_ACCESS[role];
    if (!allowed) return false;
    return allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function homeFor(role) {
    return roleByKey(role)?.home || '/';
}
