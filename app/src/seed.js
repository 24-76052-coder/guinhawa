/**
 * The product catalogue is no longer sample data: it is the 202-row master
 * list imported from `data/Pet_Product_Price_List.xlsx` (see catalog.js).
 */

import { CATALOG, CATEGORIES } from './catalog.js';

export { CATEGORIES };

/** Shared fallback picture. Imported products have no photo yet, so the POS
 *  draws the category artwork instead of pretending a stock photo is theirs. */
export const CATALOGUE_IMAGE =
    'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=120&q=75';

export const seed = {
    products: CATALOG,

    // Products removed from the active catalogue stay here so historical
    // receipts, orders and stock movements can still be traced.
    archivedProducts: [],

    catalog_version: 2,
    catalog_imported_at: '2026-10-30',
    catalog_source: 'Pet_Product_Price_List.xlsx',

    customers: [
        { id: 'CUS-001', name: 'Juan Dela Cruz', contact: '0912 345 6789', email: 'juan@email.com', address: 'Guinhawa, Malolos, Bulacan', orders: 5, status: 'Active', last: 'Sept 24' },
        { id: 'CUS-002', name: 'Maria Santos', contact: '0917 222 4100', email: 'maria@email.com', address: 'Longos, Malolos, Bulacan', orders: 3, status: 'Active', last: 'Sept 24' },
        { id: 'CUS-003', name: 'Pedro Reyes', contact: '0920 555 7812', email: 'pedro@email.com', address: 'Mojon, Malolos, Bulacan', orders: 8, status: 'Active', last: 'Sept 23' },
        { id: 'CUS-004', name: 'Ana Mendoza', contact: '0918 610 3302', email: 'ana@email.com', address: 'Tikay, Malolos, Bulacan', orders: 2, status: 'Active', last: 'Sept 22' },
    ],

    suppliers: [
        { id: 'SUP-001', name: 'Bulacan Farm Supply', contact: '0917 555 0142', email: 'sales@bulacanfarmsupply.com', address: 'Malolos, Bulacan' },
        { id: 'SUP-002', name: 'Poultry Care PH', contact: '0918 555 0198', email: 'hello@poultrycare.ph', address: 'San Miguel, Bulacan' },
        { id: 'SUP-003', name: 'Farm Essentials', contact: '0995 555 0113', email: 'orders@farmessentials.ph', address: 'Guiguinto, Bulacan' },
        { id: 'SUP-004', name: 'Pet Supplies Bulacan', contact: '0916 555 0177', email: 'info@petsuppliesbulacan.com', address: 'Meycauayan, Bulacan' },
        { id: 'SUP-005', name: 'Happy Hen Hatchery', contact: '0921 555 0124', email: 'chicks@happyhen.ph', address: 'Balagtas, Bulacan' },
    ],

    supplierDeliveries: [],

    // No sample sales or movements: the imported catalogue starts with zero
    // opening stock, and nothing should pretend a transaction already happened.
    orders: [],
    stockMoves: [],
    sales: [],
    heldOrders: [],
    inventoryIssues: [],
    auditLogs: [],

    settings: {
        store_name: 'Guinhawa Poultry Supply',
        email: 'hello@guinhawapoultry.com',
        phone: '+63 917 123 4567',
        address: 'Guinhawa, Malolos, Bulacan',
        business_hours: 'Monday – Saturday, 8:00 AM – 5:00 PM',
        description: 'Quality supplies. Healthy poultry. Happy farmers.',
        low_stock_threshold: 10,
        gcash_qr: '/qqr.jpg',
    },
};
