/**
 * Builds guinhawa_db.sql from backend/schema.sql plus the official product
 * master list (app/src/data/pet-products.json -> catalog.js).
 *
 * The catalogue is real store data imported from the price list, not demo
 * records. No customers, suppliers, sales or stock movements are seeded.
 *
 * Run: npm run sql:build
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../app/src/catalog.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function sqlString(value) {
    if (value === null || value === undefined || value === '') return "''";
    return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

const schema = await readFile(`${root}backend/schema.sql`, 'utf8');

const productRows = CATALOG.map((product) => `(
    ${product.id},
    ${sqlString(product.sku)},
    ${product.barcode ? sqlString(product.barcode) : 'NULL'},
    ${sqlString(product.name)},
    ${sqlString(product.category)},
    ${sqlString(product.subcategory)},
    ${sqlString(product.brand)},
    ${sqlString(product.description)},
    ${number(product.minimum)},
    ${product.expiration_date ? sqlString(product.expiration_date) : 'NULL'},
    ${sqlString(product.supplier)},
    ${sqlString(product.image)},
    ${sqlString(product.review)},
    ${sqlString(product.notes)},
    ${sqlString(product.source)},
    ${product.sheet_row ?? 'NULL'},
    ${product.awaiting_stock ? 1 : 0},
    0
)`).join(',\n');

const variantRows = [];
CATALOG.forEach((product) => {
    product.variants.forEach((variant) => {
        variantRows.push(`(
    ${product.id},
    ${sqlString(variant.key)},
    ${sqlString(variant.label)},
    ${sqlString(variant.unit)},
    ${sqlString(variant.unit_raw)},
    ${number(variant.price)},
    ${number(variant.minimum)},
    ${variant.assumed ? 1 : 0},
    ${variant.unit_verified ? 1 : 0}
)`);
    });
});

const inventoryRows = [];
CATALOG.forEach((product) => {
    product.variants.forEach((variant) => {
        inventoryRows.push(`(${product.id}, ${sqlString(variant.key)}, 0.00)`);
    });
});

const catalogSql = `
-- ---------------------------------------------------------------------
-- Official product master list
--
-- ${CATALOG.length} rows imported from data/Pet_Product_Price_List.xlsx
-- (sheet "Product List"). Opening stock is zero until staff record a
-- Stock In. No customers, suppliers, sales, orders or movements are seeded.
-- ---------------------------------------------------------------------

INSERT INTO products
    (id, sku, barcode, name, category, subcategory, brand, description, minimum,
     expiration_date, supplier, image, review, notes, source, sheet_row, awaiting_stock, archived)
VALUES
${productRows};

INSERT INTO product_variants
    (product_id, variant_key, label, unit, unit_raw, price, minimum, assumed, unit_verified)
VALUES
${variantRows.join(',\n')};

INSERT INTO inventory (product_id, variant_key, quantity)
VALUES
${inventoryRows.join(',\n')};

-- The installation is complete. Create the single Admin account with:
--   C:\\xampp2\\php\\php.exe backend\\scripts\\setup_admin.php
`;

const output = `${schema.trimEnd()}\n${catalogSql}`;
await writeFile(`${root}guinhawa_db.sql`, output, 'utf8');

console.log(`guinhawa_db.sql written: ${CATALOG.length} products, ${variantRows.length} selling units.`);
