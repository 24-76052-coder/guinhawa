/**
 * Product helpers shared by the catalogue, inventory, POS and reports.
 *
 * A product can be sold in more than one unit (the spreadsheet's Price A /
 * Price B columns). Each selling unit keeps its own price and its own stock,
 * so a kilogram count is never silently converted into sacks. The legacy
 * single-unit fields (`price`, `unit`, `stock`, `minimum`) mirror Price A so
 * older screens keep working.
 */

export const UNIT_SHORT = {
    Kilograms: 'kg',
    Sacks: 'sacks',
    Bags: 'bags',
    Pieces: 'pcs',
    Tablets: 'tabs',
    Bottles: 'bottles',
    Boxes: 'boxes',
    Cans: 'cans',
    Pouches: 'pouches',
    Packs: 'packs',
    Units: 'units',
};

export function unitShort(unit) {
    return UNIT_SHORT[unit] || String(unit || 'units').toLowerCase();
}

/** Always returns at least one selling unit, even for a legacy product row. */
export function variantsOf(product) {
    if (Array.isArray(product?.variants) && product.variants.length) return product.variants;
    if (!product) return [];
    return [{
        key: 'A',
        label: 'Price A',
        unit: product.unit || 'Units',
        unit_raw: product.unit || '',
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        minimum: Number(product.minimum) || 0,
        assumed: false,
        unit_verified: true,
    }];
}

export function primaryVariant(product) {
    return variantsOf(product)[0];
}

export function variantByKey(product, key) {
    return variantsOf(product).find((variant) => variant.key === key) || primaryVariant(product);
}

export function totalStock(product) {
    return variantsOf(product).reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
}

/**
 * The stock status used by the old screens (and the smoke test). Counts every
 * selling unit, so a product stocked only in sacks is not reported as out of
 * stock just because its kilogram count is zero.
 */
export function productStatus(product) {
    if (!product) return 'Out of Stock';
    const stock = totalStock(product);
    if (stock <= 0) return 'Out of Stock';
    if (stock <= Number(product.minimum || 0)) return 'Low Stock';
    return 'In Stock';
}

/**
 * The status shown in the catalogue/inventory tables. A newly imported row has
 * no opening stock yet, which is different from a product that was stocked and
 * then sold out.
 */
export function stockState(product) {
    if (!product) return 'Out of Stock';
    if (product.archived) return 'Archived';
    if (product.awaiting_stock && totalStock(product) <= 0) return 'Awaiting Opening Stock';
    return productStatus(product);
}

export function stockText(variant) {
    if (!variant) return '0';
    return `${Number(variant.stock || 0)} ${unitShort(variant.unit)}`;
}

export function stockSummary(product) {
    return variantsOf(product)
        .map((variant) => `${Number(variant.stock || 0)} ${unitShort(variant.unit)}`)
        .join(' / ');
}

export function priceText(variant, money) {
    if (!variant || variant.price == null) return '—';
    return `${money(variant.price)} / ${unitShort(variant.unit)}`;
}

export function variantLabel(product, variant) {
    return `${product.name} — ${variant.unit}`;
}

/** A unit can be sold only after its assumed/unknown unit was verified. */
export function canSellVariant(variant) {
    return Boolean(variant) && Number(variant.stock) > 0;
}

/** The first unit that is actually available, else Price A. */
export function preferredVariant(product) {
    const variants = variantsOf(product);
    return variants.find((variant) => canSellVariant(variant))
        || variants.find((variant) => variant.unit_verified !== false)
        || variants[0];
}

export function variantNeedsVerification(product) {
    return variantsOf(product).filter((variant) => variant.unit_verified === false);
}

export function hasSecondPrice(product) {
    return variantsOf(product).length > 1;
}

export function priceSortValue(product) {
    const prices = variantsOf(product).map((variant) => Number(variant.price) || 0);
    return prices.length ? Math.min(...prices) : 0;
}
