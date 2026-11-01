import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    money,
    store,
    useStore,
    categories as allCategories,
    subcategories as allSubcategories,
} from '../store.js';
import { stockState, totalStock, unitShort, variantsOf, primaryVariant } from '../products.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Pagination, Stat, StatusBadge, SummaryRow } from '../components/ui.jsx';
import { formDialog, showError, toast } from '../components/dialogs.jsx';
import AdjustStockButton from '../buttons/inventory/AdjustStockButton.jsx';

const STATUS_FILTERS = ['In Stock', 'Low Stock', 'Out of Stock', 'Awaiting Opening Stock'];
const PAGE_SIZE = 25;

export default function Inventory() {
    const state = useStore();
    const session = useSession();
    const role = session?.role || 'admin';
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');
    const [subcategory, setSubcategory] = useState('All');
    const [filter, setFilter] = useState('All');
    const [page, setPage] = useState(1);

    const categoryList = useMemo(() => allCategories(), [state.products]);
    const subcategoryList = useMemo(() => allSubcategories(category), [state.products, category]);

    const counts = state.products.reduce(
        (acc, item) => {
            const status = stockState(item);
            if (status === 'In Stock') acc.in += 1;
            if (status === 'Low Stock') acc.low += 1;
            if (status === 'Out of Stock') acc.out += 1;
            if (status === 'Awaiting Opening Stock') acc.awaiting += 1;
            return acc;
        },
        { in: 0, low: 0, out: 0, awaiting: 0 },
    );

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return state.products.filter((item) => {
            const matchesStatus = filter === 'All' || stockState(item) === filter;
            const matchesCategory = category === 'All' || item.category === category;
            const matchesSub = subcategory === 'All' || item.subcategory === subcategory;
            const matchesSearch = !keyword
                || [item.name, item.category, item.subcategory, item.brand, item.supplier, item.barcode, item.sku, item.variant, item.notes]
                    .some((field) => String(field || '').toLowerCase().includes(keyword));
            return matchesStatus && matchesCategory && matchesSub && matchesSearch;
        });
    }, [state.products, query, filter, category, subcategory]);

    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    async function adjust(item) {
        try {
            const fields = variantsOf(item).flatMap((variant) => ([
                {
                    name: `${variant.key}_stock`,
                    label: `${variant.unit} stock`,
                    type: 'number',
                    min: 0,
                    step: '0.01',
                    value: variant.stock,
                    required: true,
                },
                {
                    name: `${variant.key}_verified`,
                    label: `${variant.unit} unit verified?`,
                    type: 'select',
                    options: ['Yes', 'No'],
                    value: variant.unit_verified === false ? 'No' : 'Yes',
                },
            ]));
            fields.push(
                { name: 'minimum', label: 'Minimum stock (Unit A)', type: 'number', min: 0, step: '0.01', value: item.minimum, required: true },
                { name: 'expiration_date', label: 'Expiration date (if applicable)', type: 'date', value: item.expiration_date || '' },
            );

            const values = await formDialog({
                title: `Stock · ${item.name}`,
                fields,
                confirmText: 'Save Changes',
            });
            if (!values) return;

            const variants = variantsOf(item).map((variant) => ({
                ...variant,
                stock: Number(values[`${variant.key}_stock`] || 0),
                unit_verified: values[`${variant.key}_verified`] !== 'No',
            }));
            await store.updateProduct(item.id, {
                variants,
                minimum: Number(values.minimum || 0),
                expiration_date: values.expiration_date,
            }, session?.username || 'unknown');
            toast('Stock levels updated.');
        } catch (error) {
            showError(error);
        }
    }

    return (
        <>
            <PageHead
                title="Inventory"
                subtitle="Manage your stock levels, monitor alerts, and record movements."
                actions={
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Link className="admin-btn" style={{ background: '#2e7d32', color: '#fff', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '8px' }} to="/admin/stock-in">
                            <i className="bi bi-box-arrow-in-down"></i> Stock In
                        </Link>
                        <Link className="admin-btn" style={{ background: '#c62828', color: '#fff', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '8px' }} to="/admin/stock-out">
                            <i className="bi bi-box-arrow-up"></i> Stock Out
                        </Link>
                        <Link className="admin-soft" to={`/${role}/history`}><i className="bi bi-clock-history"></i> View History</Link>
                    </div>
                }
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-boxes" label="Total Products" value={state.products.length} hint="All catalog items" />
                <Stat tone="blue" icon="bi-check-circle" label="Available Stock" value={counts.in} hint="In healthy range" />
                <Stat tone="yellow" icon="bi-exclamation-triangle" label="Low Stock" value={counts.low} hint="Needs reordering" />
                <Stat tone="red" icon="bi-hourglass-split" label="Out of Stock" value={counts.out} hint="Currently unavailable" />
            </SummaryRow>

            <div className="admin-toolbar products-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input type="text" placeholder="Quick search products, brands, or suppliers..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                <select className="admin-select" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
                    <option value="All">All Stock Statuses</option>
                    {STATUS_FILTERS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <select className="admin-select" value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory('All'); setPage(1); }}>
                    <option value="All">All Categories</option>
                    {categoryList.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <select className="admin-select" value={subcategory} onChange={(event) => { setSubcategory(event.target.value); setPage(1); }}>
                    <option value="All">All Subcategories</option>
                    {subcategoryList.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Current Stock Levels</h2>
                        <p>{filtered.length} items found · Page {currentPage} of {pageCount}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Product</th><th>Category</th><th>Subcategory</th>
                                <th>Selling Units</th><th>Prices</th><th>Available Quantity</th>
                                <th>Minimum</th><th>Expiration</th><th>Status</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length === 0 ? (
                                <tr>
                                    <td colSpan="10">
                                        <EmptyState icon="bi-clipboard-data" title="No inventory rows" body="Try adjusting your search or filters." />
                                    </td>
                                </tr>
                            ) : visible.map((item) => {
                                const variants = variantsOf(item);
                                return (
                                    <tr key={item.id} className="clickable-row">
                                        <td>
                                            <b>{item.name}</b>
                                            <small className="cell-sub">{item.sku || 'No SKU'}{item.brand ? ` · ${item.brand}` : ''}</small>
                                        </td>
                                        <td>{item.category}</td>
                                        <td>{item.subcategory || '—'}</td>
                                        <td>
                                            <span className="stock-chips">
                                                {variants.map((variant) => (
                                                    <span key={variant.key} className="stock-chip">{variant.unit}</span>
                                                ))}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="price-list">
                                                {variants.map((variant) => (
                                                    <span key={variant.key}>
                                                        <b>{money(variant.price)}</b>
                                                        <small> / {unitShort(variant.unit)}</small>
                                                    </span>
                                                ))}
                                            </span>
                                        </td>
                                        <td className="strong-cell">
                                            <span className="stock-chips">
                                                {variants.map((variant) => (
                                                    <span key={variant.key} className="stock-chip">{variant.stock} {unitShort(variant.unit)}</span>
                                                ))}
                                            </span>
                                        </td>
                                        <td>{item.minimum} <small>{unitShort(primaryVariant(item)?.unit)}</small></td>
                                        <td>{item.expiration_date || '—'}</td>
                                        <td><StatusBadge value={stockState(item)} /></td>
                                        <td>
                                            <div className="table-actions">
                                                <AdjustStockButton onClick={() => adjust(item)} />
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
