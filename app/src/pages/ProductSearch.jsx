import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { money, useStore } from '../store.js';
import { stockState, unitShort, variantsOf } from '../products.js';
import { EmptyState, PageHead, StatusBadge } from '../components/ui.jsx';

export default function ProductSearch({ title = 'Search Products' }) {
    const state = useStore();
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(urlQuery);
    const [category, setCategory] = useState('All');
    const categories = useMemo(
        () => [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort(),
        [state.products],
    );

    useEffect(() => {
        setQuery(urlQuery);
    }, [urlQuery]);

    const filtered = state.products.filter((product) => {
        const keyword = query.trim().toLowerCase();
        const matchesQuery = !keyword || [product.name, product.category, product.subcategory, product.brand, product.barcode, product.sku]
            .some((value) => String(value || '').toLowerCase().includes(keyword));
        return matchesQuery && (category === 'All' || product.category === category);
    });

    return (
        <>
            <PageHead
                title={title}
                subtitle="Look up product prices and current availability. Product records are read-only in the counter workspace."
            />
            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product, brand, category, SKU or barcode..." />
                </label>
                <select className="admin-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="All">All Categories</option>
                    {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
            </div>
            <div className="admin-panel">
                <div className="panel-heading">
                    <div><h2>Product Availability</h2><p>{filtered.length} product{filtered.length === 1 ? '' : 's'}</p></div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Product</th><th>Category</th><th>Selling Units &amp; Prices</th><th>Available Stock</th><th>Status</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-search" title="No products found" body="Try another search or category." /></td></tr>
                            ) : filtered.map((product) => (
                                <tr key={product.id}>
                                    <td><b>{product.name}</b><small className="cell-sub">{product.subcategory || product.brand || '—'}</small></td>
                                    <td>{product.category}</td>
                                    <td>
                                        <span className="price-list">
                                            {variantsOf(product).map((variant) => (
                                                <span key={variant.key}>
                                                    <b>{money(variant.price)}</b>
                                                    <small> / {unitShort(variant.unit)}</small>
                                                </span>
                                            ))}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="stock-chips">
                                            {variantsOf(product).map((variant) => (
                                                <span key={variant.key} className="stock-chip">{variant.stock} {unitShort(variant.unit)}</span>
                                            ))}
                                        </span>
                                    </td>
                                    <td><StatusBadge value={stockState(product)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
