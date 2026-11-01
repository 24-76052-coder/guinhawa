/**
 * Application data layer.
 *
 * MySQL (through the PHP API) is the source of truth. On sign-in the store
 * hydrates `GET /api/state`; every action posts to the API and receives the
 * freshly rebuilt state back. Nothing is written to localStorage.
 *
 * The selectors and helpers below keep the same names the existing pages
 * already use, so the UI is unchanged.
 */

import { useSyncExternalStore } from 'react';
import { CATEGORIES, CATALOG, CATALOG_META } from './catalog.js';
import { api, ApiError } from './api.js';
import {
    productStatus,
    stockState,
    variantsOf,
    primaryVariant,
    totalStock,
    unitShort,
} from './products.js';

const PAYMENT_METHODS = ['Cash', 'GCash'];
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_INDEX = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const DEFAULT_SETTINGS = {
    store_name: 'Guinhawa Poultry Supply',
    email: 'hello@guinhawapoultry.com',
    phone: '+63 917 123 4567',
    address: 'Guinhawa, Malolos, Bulacan',
    business_hours: 'Monday – Saturday, 8:00 AM – 5:00 PM',
    description: 'Quality supplies. Healthy poultry. Happy farmers.',
    low_stock_threshold: 10,
    gcash_qr: '/qqr.jpg',
};

const listeners = new Set();
let ready = false;
let loading = null;

function emptyState() {
    return {
        products: [],
        archivedProducts: [],
        catalog_version: 2,
        catalog_imported_at: '',
        catalog_source: 'Pet_Product_Price_List.xlsx',
        customers: [],
        suppliers: [],
        supplierDeliveries: [],
        orders: [],
        stockMoves: [],
        sales: [],
        heldOrders: [],
        inventoryIssues: [],
        attendance: [],
        auditLogs: [],
        settings: { ...DEFAULT_SETTINGS },
    };
}

function normaliseVariant(variant, index) {
    const unit = String(variant?.unit || 'Units').trim() || 'Units';
    const price = Number(variant?.price);
    const stock = Number(variant?.stock);
    return {
        key: String(variant?.key || (index === 0 ? 'A' : 'B')),
        label: variant?.label || (index === 0 ? 'Price A' : 'Price B'),
        unit,
        unit_raw: variant?.unit_raw || '',
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        minimum: Number(variant?.minimum) || 0,
        assumed: Boolean(variant?.assumed),
        unit_verified: variant?.unit_verified !== false,
    };
}

function normaliseProduct(product) {
    const variants = (Array.isArray(product?.variants) && product.variants.length
        ? product.variants
        : [{
            key: 'A',
            label: 'Price A',
            unit: product?.unit || 'Units',
            unit_raw: product?.unit || '',
            price: Number(product?.price) || 0,
            stock: Number(product?.stock) || 0,
            minimum: Number(product?.minimum) || 0,
            assumed: false,
            unit_verified: true,
        }]).map(normaliseVariant);

    const primary = variants[0];
    const storedAwaiting = product?.awaiting_stock === undefined
        ? variants.every((variant) => Number(variant.stock) <= 0)
        : Boolean(product.awaiting_stock);

    return {
        ...product,
        id: Number(product?.id),
        sku: product?.sku || '',
        barcode: product?.barcode || '',
        name: String(product?.name || '').trim(),
        category: product?.category || 'Other',
        subcategory: product?.subcategory || '',
        brand: product?.brand || (product?.category === 'Feeds' ? product?.subcategory || '' : ''),
        description: product?.description || '',
        variants,
        price: primary.price,
        unit: primary.unit,
        stock: primary.stock,
        minimum: Number(product?.minimum) || 0,
        awaiting_stock: storedAwaiting && variants.every((variant) => Number(variant.stock) <= 0),
        expiration_date: product?.expiration_date || '',
        supplier: product?.supplier || '',
        image: product?.image || '',
        review: product?.review || 'Listed',
        notes: product?.notes || '',
        source: product?.source || '',
        sheet_row: product?.sheet_row || null,
        updated: product?.updated || 'Recent',
        archived: Boolean(product?.archived),
    };
}

function normaliseState(parsed) {
    const base = emptyState();
    const source = parsed && typeof parsed === 'object' ? parsed : {};
    return {
        ...base,
        ...source,
        products: (Array.isArray(source.products) ? source.products : []).map(normaliseProduct),
        archivedProducts: (Array.isArray(source.archivedProducts) ? source.archivedProducts : []).map(normaliseProduct),
        customers: Array.isArray(source.customers) ? source.customers : [],
        suppliers: Array.isArray(source.suppliers) ? source.suppliers : [],
        supplierDeliveries: Array.isArray(source.supplierDeliveries) ? source.supplierDeliveries : [],
        orders: Array.isArray(source.orders) ? source.orders : [],
        stockMoves: Array.isArray(source.stockMoves) ? source.stockMoves : [],
        sales: Array.isArray(source.sales) ? source.sales : [],
        heldOrders: Array.isArray(source.heldOrders) ? source.heldOrders : [],
        inventoryIssues: Array.isArray(source.inventoryIssues) ? source.inventoryIssues : [],
        attendance: Array.isArray(source.attendance) ? source.attendance : [],
        auditLogs: Array.isArray(source.auditLogs) ? source.auditLogs : [],
        settings: { ...DEFAULT_SETTINGS, ...(source.settings || {}) },
    };
}

let state = normaliseState(null);

function emit() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getState() {
    return state;
}

function applyState(next) {
    state = normaliseState(next);
    ready = true;
    emit();
    return state;
}

/** Load the whole database snapshot. Safe to call repeatedly. */
export function hydrateStore(force = false) {
    if (loading && !force) return loading;
    loading = api('/state')
        .then(({ state: next }) => applyState(next))
        .finally(() => {
            loading = null;
        });
    return loading;
}

/** Called on sign-out so the next account never sees the previous snapshot. */
export function clearStore() {
    state = normaliseState(null);
    ready = false;
    loading = null;
    emit();
}

export function useStore() {
    return useSyncExternalStore(subscribe, getState, getState);
}

export function useStoreReady() {
    return useSyncExternalStore(subscribe, () => ready, () => ready);
}

export function isStoreHydrated() {
    return ready;
}

// ------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------

export function money(value) {
    return `\u20b1${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayLabel(date = new Date()) {
    return `${MONTHS[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
}

export function localTimestamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${isoDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function clockParts(now = new Date()) {
    let hours = now.getHours();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return {
        date: `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`,
        time: `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        period,
    };
}

export { productStatus, stockState };

export function statusSlug(value) {
    return String(value).toLowerCase().replaceAll(' ', '-');
}

export function categories() {
    const extra = state.products.map((product) => product.category).filter((name) => !CATEGORIES.includes(name));
    return [...CATEGORIES, ...new Set(extra)];
}

export function subcategories(category = 'All') {
    const source = !category || category === 'All'
        ? state.products
        : state.products.filter((product) => product.category === category);
    return [...new Set(source.map((product) => product.subcategory).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
}

export function brands(category = 'All') {
    const source = !category || category === 'All'
        ? state.products
        : state.products.filter((product) => product.category === category);
    return [...new Set(source.map((product) => product.brand).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
}

export function isoDate(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayLabel(iso) {
    if (!iso) return '';
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toISODate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const lower = raw.toLowerCase();
    if (lower === 'today') return isoDate();
    if (lower === 'yesterday') return isoDate(new Date(Date.now() - 86400000));

    const parts = lower.match(/^([a-z]+)\.?\s+(\d{1,2})(?:,)?\s*(\d{4})?/);
    if (!parts) return null;
    const month = MONTH_INDEX[parts[1]];
    if (month === undefined) return null;
    const year = parts[3] ? Number(parts[3]) : new Date().getFullYear();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(Number(parts[2])).padStart(2, '0')}`;
}

export function stockAtDate(product, iso, moves = []) {
    if (!product) return 0;
    let stock = totalStock(product);
    if (!iso) return Math.max(0, stock);
    moves.forEach((move) => {
        const sameProduct = move.product_id != null
            ? Number(move.product_id) === Number(product.id)
            : move.product === product.name;
        if (!sameProduct) return;
        const moved = toISODate(move.date);
        if (!moved || moved <= iso) return;
        const quantity = Number(move.quantity) || 0;
        if (move.action === 'Stock In') stock -= quantity;
        else if (move.action === 'Adjustment') stock += (Number(move.previous) || 0) - (Number(move.next) || 0);
        else stock += quantity;
    });
    return Math.max(0, stock);
}

export function categorySummary(snapshot, iso = '') {
    const source = snapshot || state;
    const products = source.products || [];
    const matches = (value) => !iso || toISODate(value) === iso;
    const groups = new Map();

    const add = (category, quantity, amount) => {
        const key = category || 'Other';
        const entry = groups.get(key) || { category: key, transactions: 0, quantity: 0, sales: 0 };
        entry.transactions += 1;
        entry.quantity += Number(quantity) || 0;
        entry.sales += Number(amount) || 0;
        groups.set(key, entry);
    };

    (source.orders || [])
        .filter((order) => order.status !== 'Cancelled' && matches(order.date))
        .forEach((order) => {
            const product = products.find((item) => item.name === order.product);
            add(product?.category, order.quantity, order.total);
        });

    (source.sales || [])
        .filter((sale) => matches(sale.date) || matches(sale.created_at))
        .forEach((sale) => {
            const perCategory = new Map();
            (sale.items || []).forEach((item) => {
                const key = item.category || 'Other';
                const bucket = perCategory.get(key) || { quantity: 0, total: 0 };
                bucket.quantity += Number(item.quantity) || 0;
                bucket.total += Number(item.total) || 0;
                perCategory.set(key, bucket);
            });
            perCategory.forEach((bucket, key) => add(key, bucket.quantity, bucket.total));
        });

    return [...groups.values()].sort((a, b) => b.sales - a.sales);
}

// ------------------------------------------------------------
// API-backed actions
// ------------------------------------------------------------

async function mutate(path, body, method = 'POST') {
    const data = await api(path, { method, body });
    if (data.state) applyState(data.state);
    return data;
}

async function addProduct(data) {
    const response = await mutate('/products', data);
    return response.product;
}

async function updateProduct(id, patch) {
    const response = await mutate(`/products/${id}`, patch, 'PUT');
    return response.product;
}

async function removeProduct(id) {
    const response = await mutate(`/products/${id}`, undefined, 'DELETE');
    return response.product;
}

async function restoreProduct(id) {
    return mutate(`/products/${id}/restore`, {});
}

async function stockIn(args) {
    return mutate('/stock/in', args);
}

async function stockOut(args) {
    return mutate('/stock/out', args);
}

async function recordInventoryIssue(args) {
    return mutate('/stock/out', args);
}

async function addCustomer(data) {
    return mutate('/customers', data);
}

async function updateCustomer(id, patch) {
    return mutate(`/customers/${id}`, patch, 'PUT');
}

async function removeCustomer(id) {
    return mutate(`/customers/${id}`, undefined, 'DELETE');
}

async function addSupplier(data) {
    return mutate('/suppliers', data);
}

async function updateSupplier(id, patch) {
    return mutate(`/suppliers/${id}`, patch, 'PUT');
}

async function removeSupplier(id) {
    return mutate(`/suppliers/${id}`, undefined, 'DELETE');
}

async function recordSupplierDelivery(args) {
    return mutate('/suppliers/deliveries', args);
}

async function setOrderStatus(id, status) {
    return mutate(`/orders/${id}/status`, { status }, 'PATCH');
}

async function checkout(args) {
    const response = await mutate('/sales/checkout', args);
    return response.sale;
}

async function holdOrder(args) {
    const response = await mutate('/sales/held', args);
    return response.held;
}

async function removeHeldOrder(id) {
    return mutate(`/sales/held/${id}`, undefined, 'DELETE');
}

async function saveSettings(patch) {
    const response = await mutate('/settings', patch, 'PUT');
    return response.state.settings;
}

async function clockIn(args) {
    return mutate('/attendance/clock-in', args);
}

async function clockOut(args) {
    return mutate('/attendance/clock-out', args);
}

async function restoreState(snapshot) {
    return mutate('/state/restore', snapshot);
}

export const store = {
    getState,
    subscribe,
    hydrate: hydrateStore,
    clear: clearStore,
    addProduct,
    updateProduct,
    removeProduct,
    restoreProduct,
    stockIn,
    stockOut,
    recordInventoryIssue,
    addCustomer,
    updateCustomer,
    removeCustomer,
    addSupplier,
    updateSupplier,
    removeSupplier,
    recordSupplierDelivery,
    setOrderStatus,
    checkout,
    holdOrder,
    removeHeldOrder,
    saveSettings,
    clockIn,
    clockOut,
    restoreState,
};

export { ApiError, ORDER_STATUSES, PAYMENT_METHODS, CATALOG_META, CATALOG, CATEGORIES };
