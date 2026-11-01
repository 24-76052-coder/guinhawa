import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    money,
    store,
    useStore,
    categories as allCategories,
} from '../store.js';
import { CATALOG_META, UNIT_OPTIONS } from '../catalog.js';
import {
    hasSecondPrice,
    priceSortValue,
    primaryVariant,
    stockState,
    stockSummary,
    totalStock,
    unitShort,
    variantsOf,
} from '../products.js';
import { useSession } from '../auth.js';
import { confirmAction, formDialog, showError, toast, GREEN } from '../components/dialogs.jsx';
import { EmptyState, PageHead, Pagination, Stat, StatusBadge, SummaryRow } from '../components/ui.jsx';
import ProductArt from '../components/ProductArt.jsx';
import AddProductButton from '../buttons/inventory/AddProductButton.jsx';
import ViewRowButton from '../buttons/staff/ViewRowButton.jsx';
import EditRowButton from '../buttons/staff/EditRowButton.jsx';
import DeleteRowButton from '../buttons/staff/DeleteRowButton.jsx';
import Swal from 'sweetalert2';

const PAGE_SIZE = 20;

const SORTS = [
    { value: 'name-asc', label: 'Name A → Z' },
    { value: 'name-desc', label: 'Name Z → A' },
    { value: 'price-asc', label: 'Price low → high' },
    { value: 'price-desc', label: 'Price high → low' },
    { value: 'stock-asc', label: 'Stock low → high' },
    { value: 'stock-desc', label: 'Stock high → low' },
    { value: 'category', label: 'Category' },
];

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
}

function productFields(product) {
    const a = product ? primaryVariant(product) : null;
    const b = product ? variantsOf(product).find((variant) => variant.key === 'B') : null;

    return [
        { name: 'name', label: 'Product Name', value: product?.name || '', required: true, placeholder: 'e.g. African Mix' },
        { name: 'category', label: 'Category', type: 'select', options: allCategories(), value: product?.category || 'Feeds', required: true },
        { name: 'subcategory', label: 'Subcategory / Brand', value: product?.subcategory || '', placeholder: 'e.g. BMEG, Dry dog food' },
        { name: 'brand', label: 'Brand (feeds)', value: product?.brand || '', placeholder: 'e.g. BMEG' },
        { name: 'sku', label: 'SKU', value: product?.sku || '', placeholder: 'Leave blank to generate' },
        { name: 'barcode', label: 'Barcode', value: product?.barcode || '', placeholder: 'Scan or enter barcode' },
        { name: 'price_a', label: 'Price A (₱)', type: 'number', step: '0.01', min: 0, value: a?.price ?? 0, required: true },
        { name: 'unit_a', label: 'Unit A', type: 'select', options: UNIT_OPTIONS, value: a?.unit || 'Pieces', required: true },
        { name: 'unit_a_verified', label: 'Unit A verified?', type: 'select', options: ['Yes', 'No'], value: a?.unit_verified === false ? 'No' : 'Yes' },
        { name: 'price_b', label: 'Price B (₱, optional)', type: 'number', step: '0.01', min: 0, value: b?.price ?? '', placeholder: 'Leave blank when there is no second price' },
        { name: 'unit_b', label: 'Unit B', type: 'select', options: UNIT_OPTIONS, value: b?.unit || 'Sacks' },
        { name: 'unit_b_verified', label: 'Unit B verified?', type: 'select', options: ['Yes', 'No'], value: b?.unit_verified === false ? 'No' : 'Yes' },
        { name: 'stock_a', label: 'Stock A (Unit A)', type: 'number', min: 0, step: '0.01', value: a?.stock ?? 0, required: true },
        { name: 'stock_b', label: 'Stock B (Unit B)', type: 'number', min: 0, step: '0.01', value: b?.stock ?? 0 },
        { name: 'minimum', label: 'Minimum Stock', type: 'number', min: 0, step: '0.01', value: product?.minimum ?? 0, required: true },
        { name: 'expiration_date', label: 'Expiration Date', type: 'date', value: product?.expiration_date || '' },
        { name: 'supplier', label: 'Supplier', value: product?.supplier || '', placeholder: 'Optional' },
        { name: 'image', label: 'Image URL', value: product?.image || '', placeholder: 'Optional product photo' },
        { name: 'review', label: 'Review Status', type: 'select', options: ['Listed', 'Verify'], value: product?.review || 'Listed' },
        { name: 'description', label: 'Description', type: 'textarea', value: product?.description || '' },
        { name: 'notes', label: 'Import Notes', type: 'textarea', value: product?.notes || '', placeholder: 'Notes from the price list' },
    ];
}

function payloadFrom(values) {
    return {
        ...values,
        price_a: Number(values.price_a),
        price_b: values.price_b === '' || values.price_b === undefined ? null : Number(values.price_b),
        stock_a: Number(values.stock_a || 0),
        stock_b: Number(values.stock_b || 0),
        minimum: Number(values.minimum || 0),
    };
}

export default function Products() {
    const state = useStore();
    const session = useSession();
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(urlQuery);
    const [category, setCategory] = useState('All');
    const [sort, setSort] = useState('name-asc');
    const [page, setPage] = useState(1);

    const categoryList = useMemo(() => allCategories(), [state.products]);
    const awaiting = state.products.filter((product) => product.awaiting_stock).length;

    useEffect(() => {
        setQuery(urlQuery);
    }, [urlQuery]);

    useEffect(() => {
        setPage(1);
    }, [query, category, sort]);

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        const rows = state.products.filter((item) => {
            const matchesCategory = category === 'All' || item.category === category;
            const matchesSearch = !keyword
                || [item.name, item.category, item.subcategory, item.brand, item.supplier, item.description, item.barcode, item.sku, item.variant, item.notes]
                    .some((field) => String(field || '').toLowerCase().includes(keyword));
            return matchesCategory && matchesSearch;
        });

        return rows.sort((a, b) => {
            if (sort === 'name-desc') return b.name.localeCompare(a.name);
            if (sort === 'price-asc') return priceSortValue(a) - priceSortValue(b);
            if (sort === 'price-desc') return priceSortValue(b) - priceSortValue(a);
            if (sort === 'stock-asc') return totalStock(a) - totalStock(b);
            if (sort === 'stock-desc') return totalStock(b) - totalStock(a);
            if (sort === 'category') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });
    }, [state.products, query, category, sort]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const filtersActive = Boolean(query.trim())
        || category !== 'All'
        || sort !== 'name-asc';

    function clearFilters() {
        setQuery('');
        setCategory('All');
        setSort('name-asc');
        setPage(1);
    }

    async function addProduct() {
        try {
            const values = await formDialog({ title: 'Add Product', fields: productFields(null), confirmText: 'Add Product' });
            if (!values) return;
            await store.addProduct(payloadFrom(values), session?.username || 'unknown');
            toast('Product added.');
        } catch (error) {
            showError(error);
        }
    }

    async function editProduct(item) {
        try {
            const values = await formDialog({ title: `Edit ${item.name}`, fields: productFields(item), confirmText: 'Save Changes' });
            if (!values) return;
            await store.updateProduct(item.id, payloadFrom(values), session?.username || 'unknown');
            toast('Product updated.');
        } catch (error) {
            showError(error);
        }
    }

    async function deleteProduct(item) {
        const ok = await confirmAction({
            title: 'Archive product?',
            text: `${item.name} will leave the active catalogue. Its receipts, sales and stock history are kept, and the record stays archived.`,
            confirmText: 'Archive',
        });
        if (!ok) return;
        try {
            await store.removeProduct(item.id);
            toast('Product archived.');
        } catch (error) {
            showError(error);
        }
    }

    function viewProduct(item) {
        const variants = variantsOf(item);
        const rows = variants.map((variant) => `
            <div><span>${escapeHtml(variant.label)}</span><b>${money(variant.price)} / ${escapeHtml(unitShort(variant.unit))}</b></div>
            <div><span>${escapeHtml(variant.unit)} stock</span><b>${escapeHtml(String(variant.stock))} ${escapeHtml(unitShort(variant.unit))}</b></div>
        `).join('');

        Swal.fire({
            title: escapeHtml(item.name),
            html: `
                <div class="detail-modal">
                    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />` : ''}
                    <div><span>Category</span><b>${escapeHtml(item.category)}</b></div>
                    <div><span>Subcategory</span><b>${escapeHtml(item.subcategory || '—')}</b></div>
                    <div><span>Brand</span><b>${escapeHtml(item.brand || '—')}</b></div>
                    <div><span>SKU / Barcode</span><b>${escapeHtml(item.sku || '—')} / ${escapeHtml(item.barcode || '—')}</b></div>
                    ${rows}
                    <div><span>Minimum Stock</span><b>${escapeHtml(String(item.minimum))} ${escapeHtml(unitShort(primaryVariant(item)?.unit))}</b></div>
                    <div><span>Status</span><b>${escapeHtml(stockState(item))}</b></div>
                    <div><span>Review</span><b>${escapeHtml(item.review || 'Listed')}</b></div>
                    <div><span>Source</span><b>${escapeHtml(item.source || '—')}</b></div>
                    <div><span>Supplier</span><b>${escapeHtml(item.supplier || '—')}</b></div>
                    <div><span>Expiration</span><b>${escapeHtml(item.expiration_date || '—')}</b></div>
                    <div style="grid-column: 1 / -1;"><span>Notes</span><p style="margin: 2px 0 0; font-size: 13px; color: #405643;">${escapeHtml(item.notes || 'No notes recorded.')}</p></div>
                </div>`,
            showCancelButton: true,
            confirmButtonText: 'Close',
            confirmButtonColor: GREEN,
            width: 700,
        });
    }

    function showImportSummary() {
        const counts = CATALOG_META.categories;
        const archived = (state.archivedProducts || []).length;
        const repeated = CATALOG_META.repeated_names
            .map((row) => `<li><b>${escapeHtml(row.name)}</b> ×${row.count} — ${escapeHtml(row.rows.join(' | '))}</li>`)
            .join('');
        Swal.fire({
            title: 'Catalogue import summary',
            html: `
                <div class="import-summary">
                    <p class="import-source"><i class="bi bi-file-earmark-excel"></i> ${escapeHtml(CATALOG_META.source)} · sheet “${escapeHtml(CATALOG_META.sheet)}”</p>
                    <div class="import-grid">
                        <div><span>Total imported</span><b>${CATALOG_META.total}</b></div>
                        <div><span>Feeds</span><b>${counts.Feeds}</b></div>
                        <div><span>Accessories</span><b>${counts.Accessories}</b></div>
                        <div><span>Medicine</span><b>${counts.Medicine}</b></div>
                        <div><span>Dog Food</span><b>${counts['Dog Food']}</b></div>
                        <div><span>Cat Food</span><b>${counts['Cat Food']}</b></div>
                        <div><span>Active products now</span><b>${state.products.length}</b></div>
                        <div><span>Archived old products</span><b>${archived}</b></div>
                        <div><span>Exact duplicate rows</span><b>${CATALOG_META.duplicate_rows.length}</b></div>
                        <div><span>Price verification</span><b>${CATALOG_META.price_verification}</b></div>
                        <div><span>Unit verification</span><b>${CATALOG_META.unit_verification}</b></div>
                        <div><span>Awaiting opening stock</span><b>${awaiting}</b></div>
                    </div>
                    <p class="import-note"><b>${CATALOG_META.price_b_count}</b> products carry a second price (Price B). Repeated names are kept as separate rows because they belong to different brands or subcategories:</p>
                    <ul class="import-list">${repeated || '<li>None</li>'}</ul>
                </div>`,
            confirmButtonText: 'Close',
            confirmButtonColor: GREEN,
            width: 780,
        });
    }

    return (
        <>
            <PageHead
                title="Products"
                subtitle="The official Guinhawa master list — 202 products across feeds, accessories, medicine, dog food and cat food."
                actions={(
                    <div className="page-actions">
                        <button type="button" className="admin-soft" onClick={showImportSummary}>
                            <i className="bi bi-clipboard-data"></i> Import Summary
                        </button>
                        <AddProductButton onClick={addProduct} />
                    </div>
                )}
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-box-seam" label="Total Products" value={state.products.length} hint={`${CATALOG_META.categories.Feeds} feeds · ${CATALOG_META.categories.Accessories} accessories`} />
                <Stat tone="blue" icon="bi-grid-3x3-gap" label="Categories" value={Object.keys(CATALOG_META.categories).length} hint="Feeds, accessories, medicine, dog & cat food" />
                <Stat tone="yellow" icon="bi-hourglass-split" label="Awaiting Opening Stock" value={awaiting} hint="Zero stock until a Stock In is recorded" />
                <Stat tone="red" icon="bi-exclamation-diamond" label="Needs Verification" value={CATALOG_META.price_verification} hint={`${CATALOG_META.unit_verification} units assumed / not stated`} />
            </SummaryRow>

            <div className="catalog-toolbar">
                <div className="catalog-toolbar-top">
                    <div className="catalog-field catalog-search-field">
                        <span>Search</span>
                        <label className="admin-search catalog-search">
                            <i className="bi bi-search"></i>
                            <input
                                type="search"
                                placeholder="Search name, brand, SKU, barcode or notes..."
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                aria-label="Search products"
                            />
                        </label>
                    </div>
                    <label className="catalog-field catalog-category">
                        <span>Category</span>
                        <select className="admin-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                            <option value="All">All categories</option>
                            {categoryList.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </label>
                    <label className="catalog-field catalog-sort">
                        <span>Sort by</span>
                        <select className="admin-select" value={sort} onChange={(event) => setSort(event.target.value)}>
                            {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <button
                        type="button"
                        className={`admin-soft catalog-clear${filtersActive ? ' is-on' : ''}`}
                        onClick={clearFilters}
                        disabled={!filtersActive}
                    >
                        <i className="bi bi-arrow-counterclockwise"></i> Reset
                    </button>
                </div>
            </div>

            <div className="admin-panel">
                <div className="panel-heading catalog-panel-head">
                    <div>
                        <h2>Product List</h2>
                        <p>{filtered.length} of {state.products.length} products · page {currentPage} of {pageCount}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table className="product-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Price A / Unit</th>
                                <th>Price B / Unit</th>
                                <th>Available Stock</th>
                                <th>Status</th>
                                <th className="actions-col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 ? (
                                <tr>
                                    <td colSpan="7">
                                        <EmptyState
                                            icon="bi-box-seam"
                                            title="No products found"
                                            body="Try a different search or category."
                                            action={<AddProductButton onClick={addProduct} />}
                                        />
                                    </td>
                                </tr>
                            ) : visible.map((item) => {
                                const a = primaryVariant(item);
                                const b = variantsOf(item).find((variant) => variant.key === 'B');
                                return (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="product-cell">
                                                <ProductArt product={item} className="product-thumb" />
                                                <span>
                                                    <b>{item.name}</b>
                                                    <small>{item.sku || 'No SKU'} · {item.brand || item.category}</small>
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="category-cell">
                                                <b>{item.category}</b>
                                                <small>{item.subcategory || '—'}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="price-cell">
                                                <span className="price-line">
                                                    <b>{money(a?.price)}</b>
                                                </span>
                                                <small>per {unitShort(a?.unit)}</small>
                                            </div>
                                        </td>
                                        <td>
                                            {hasSecondPrice(item) && b ? (
                                                <div className="price-cell">
                                                    <span className="price-line">
                                                        <b>{money(b.price)}</b>
                                                    </span>
                                                    <small>per {unitShort(b.unit)}</small>
                                                </div>
                                            ) : <span className="muted-cell">—</span>}
                                        </td>
                                        <td>
                                            <span className="stock-chips">
                                                {variantsOf(item).map((variant) => (
                                                    <span key={variant.key} className="stock-chip">
                                                        {variant.stock} {unitShort(variant.unit)}
                                                    </span>
                                                ))}
                                            </span>
                                        </td>
                                        <td><StatusBadge value={stockState(item)} /></td>
                                        <td>
                                            <div className="table-actions">
                                                <ViewRowButton title="View details" onClick={() => viewProduct(item)} />
                                                <EditRowButton title="Edit product" onClick={() => editProduct(item)} />
                                                <DeleteRowButton title="Archive product" onClick={() => deleteProduct(item)} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
            </div>
        </>
    );
}
