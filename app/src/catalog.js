/**
 * The official Guinhawa Poultry Supply product master list.
 *
 * `data/pet-products.json` is the row-for-row import of
 * `data/Pet_Product_Price_List.xlsx` (sheet "Product List", rows 9-210).
 * This module turns those rows into the product records the app stores:
 * one product per spreadsheet row, with Price A / Unit A and, where the
 * sheet supplies it, Price B / Unit B kept as separate selling units.
 *
 * Nothing here invents stock, prices, brands or barcodes. Opening stock is
 * zero until inventory staff record a Stock In, and units the sheet marks as
 * assumed (or does not state) stay flagged for verification before the POS
 * will sell them.
 */

import rows from './data/pet-products.json' with { type: 'json' };

export const CATEGORIES = ['Feeds', 'Accessories', 'Medicine', 'Dog Food', 'Cat Food'];

export const UNIT_OPTIONS = [
    'Kilograms',
    'Sacks',
    'Bags',
    'Pieces',
    'Tablets',
    'Bottles',
    'Boxes',
    'Cans',
    'Pouches',
    'Packs',
    'Units',
];

const UNIT_MAP = {
    'kg (assumed)': 'Kilograms',
    'sack (assumed)': 'Sacks',
    'bag (assumed)': 'Bags',
    'bag': 'Bags',
    'piece': 'Pieces',
    'piece (assumed)': 'Pieces',
    'tablet': 'Tablets',
    'box': 'Boxes',
    'can': 'Cans',
    'pouch': 'Pouches',
    'pack (assumed)': 'Packs',
    'not stated': 'Units',
};

function unitMeta(raw) {
    const unitRaw = String(raw || '').trim();
    const unit = UNIT_MAP[unitRaw.toLowerCase()] || 'Units';
    const assumed = /assumed|not stated/i.test(unitRaw);
    return {
        unit,
        unit_raw: unitRaw,
        assumed,
        // Units written plainly in the sheet count as confirmed. Anything the
        // sheet itself calls assumed / not stated needs an admin to verify it.
        unit_verified: !assumed,
    };
}

function buildProduct(row, index) {
    const a = unitMeta(row.unit_a);
    const variants = [{
        key: 'A',
        label: 'Price A',
        unit: a.unit,
        unit_raw: a.unit_raw,
        price: row.price_a,
        stock: 0,
        minimum: 0,
        assumed: a.assumed,
        unit_verified: a.unit_verified,
    }];

    if (row.price_b != null) {
        const b = unitMeta(row.unit_b);
        variants.push({
            key: 'B',
            label: 'Price B',
            unit: b.unit,
            unit_raw: b.unit_raw,
            price: row.price_b,
            stock: 0,
            minimum: 0,
            assumed: b.assumed,
            unit_verified: b.unit_verified,
        });
    }

    return {
        id: index + 1,
        sku: `GPS-${String(1001 + index).padStart(4, '0')}`,
        barcode: '',
        name: row.name,
        category: row.category,
        subcategory: row.subcategory,
        // For feeds the sheet groups rows by brand; elsewhere the subcategory
        // is the product type, so only feeds carry a brand.
        brand: row.category === 'Feeds' ? row.subcategory : '',
        description: '',
        price: variants[0].price,
        unit: variants[0].unit,
        stock: 0,
        minimum: 0,
        variants,
        awaiting_stock: true,
        expiration_date: '',
        supplier: '',
        image: '',
        review: row.review,
        notes: row.notes,
        source: row.source,
        sheet_row: row.row,
        updated: 'Imported',
        archived: false,
    };
}

export const CATALOG = rows.map(buildProduct);

export const CATALOG_META = (() => {
    const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
    const bySubcategory = {};
    const names = new Map();
    const keys = new Map();
    let priceB = 0;
    let verify = 0;
    let unitVerification = 0;

    CATALOG.forEach((product) => {
        byCategory[product.category] = (byCategory[product.category] || 0) + 1;
        const subKey = `${product.category}|${product.subcategory}`;
        bySubcategory[subKey] = (bySubcategory[subKey] || 0) + 1;
        names.set(product.name.toLowerCase(), (names.get(product.name.toLowerCase()) || 0) + 1);
        const composite = `${product.category}|${product.subcategory}|${product.name}`.toLowerCase();
        keys.set(composite, (keys.get(composite) || 0) + 1);
        if (product.variants.length > 1) priceB += 1;
        if (product.review === 'Verify') verify += 1;
        unitVerification += product.variants.filter((variant) => !variant.unit_verified).length;
    });

    const repeatedNames = [...names.entries()]
        .filter(([, count]) => count > 1)
        .map(([name]) => {
            const matches = CATALOG.filter((product) => product.name.toLowerCase() === name);
            return {
                name: matches[0].name,
                count: matches.length,
                rows: matches.map((product) => `${product.category} · ${product.subcategory}`),
            };
        });

    const duplicateRows = [...keys.entries()]
        .filter(([, count]) => count > 1)
        .map(([key]) => key);

    return {
        source: 'Pet_Product_Price_List.xlsx',
        sheet: 'Product List',
        imported_at: '2026-10-30',
        total: CATALOG.length,
        categories: byCategory,
        subcategories: bySubcategory,
        price_b_count: priceB,
        price_verification: verify,
        unit_verification: unitVerification,
        awaiting_stock: CATALOG.filter((product) => product.awaiting_stock).length,
        repeated_names: repeatedNames,
        duplicate_rows: duplicateRows,
    };
})();

/** A stable key used to stop the same sheet row being imported twice. */
export function catalogueKey(product) {
    return `${product.category}|${product.subcategory}|${product.name}`.toLowerCase();
}
