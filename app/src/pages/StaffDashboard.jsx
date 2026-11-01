import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isoDate, money, stockState, toISODate, useStore } from '../store.js';
import { totalStock, unitShort, variantsOf } from '../products.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Stat, StatusBadge, SummaryRow } from '../components/ui.jsx';
import InventoryStaffDashboard from './InventoryStaffDashboard.jsx';

function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
}

export default function StaffDashboard() {
    const state = useStore();
    const session = useSession();
    const [query, setQuery] = useState('');

    if (session?.role === 'inventory-staff') return <InventoryStaffDashboard />;

    const today = isoDate();
    const salesToday = state.sales.filter((sale) =>
        (sale.staff_id === session?.username || sale.cashier === session?.username) && (toISODate(sale.date) === today || toISODate(sale.created_at) === today),
    );
    const todaySales = salesToday.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const lowStock = state.products.filter((product) => stockState(product) !== 'In Stock'
        && !(product.awaiting_stock && totalStock(product) <= 0));
    const keyword = query.trim().toLowerCase();
    const products = state.products.filter((product) =>
        !keyword || [product.name, product.category, product.subcategory, product.brand, product.barcode, product.sku]
            .some((value) => String(value || '').toLowerCase().includes(keyword)),
    ).slice(0, 6);

    return (
        <>
            <PageHead
                kicker={`${greeting()}, ${session?.name || 'Staff'}!`}
                title="Counter Staff Dashboard"
                subtitle="Customer purchases, cashier operations, and live product availability."
            />

            <SummaryRow className="dashboard-stats">
                <Stat tone="green" icon="bi-cash-coin" label="Sales Today" value={money(todaySales)} hint="Completed counter sales" />
                <Stat tone="blue" icon="bi-receipt" label="Completed Transactions" value={salesToday.length} hint="Receipts issued today" />
                <Stat tone="green" icon="bi-box-seam" label="Products Available" value={state.products.filter((product) => totalStock(product) > 0).length} hint="Products with stock on hand" />
                <Stat tone="yellow" icon="bi-exclamation-triangle" label="Low-Stock Alerts" value={lowStock.length} hint="At or below minimum stock" />
            </SummaryRow>

            <div className="dashboard-grid">
                <section className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-heading">
                        <div>
                            <h2>Product Availability</h2>
                            <p>Search prices, categories, and current stock before serving a customer.</p>
                        </div>
                        <Link className="admin-soft" to="/counter-staff/available-stocks">View all stocks <i className="bi bi-arrow-right"></i></Link>
                    </div>
                    <div className="admin-toolbar">
                        <label className="admin-search">
                            <i className="bi bi-search"></i>
                            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product or category..." />
                        </label>
                        <Link className="admin-primary" to="/counter-staff/pos"><i className="bi bi-upc-scan"></i> Open POS</Link>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Product</th><th>Category</th><th>Selling Units &amp; Prices</th><th>Available</th><th>Status</th></tr></thead>
                            <tbody>
                                {products.length ? products.map((product) => (
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
                                )) : <tr><td colSpan="5"><EmptyState icon="bi-search" title="No products match" body="Try another product name or category." /></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
                {lowStock.length ? (
                    <section className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                        <div className="panel-heading">
                            <div><h2>Low-Stock Alerts</h2><p>Share these restock needs with inventory staff.</p></div>
                        </div>
                        <div className="low-stock-list">
                            {lowStock.slice(0, 5).map((product) => (
                                <div className="low-stock-row" key={product.id}>
                                    <span><b>{product.name}</b><small>{product.category} · minimum {product.minimum} {unitShort(product.unit)}</small></span>
                                    <span className={`stock-alert${totalStock(product) === 0 ? ' empty' : ''}`}>
                                        {totalStock(product) === 0 ? 'Out of stock' : `${totalStock(product)} left`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </>
    );
}
