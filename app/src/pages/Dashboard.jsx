import { Link, useNavigate } from 'react-router-dom';
import { money, productStatus, useStore } from '../store.js';
import { totalStock as productStock, unitShort, variantsOf } from '../products.js';
import { useSession } from '../auth.js';
import AdminWelcome from '../components/AdminWelcome.jsx';
import ProductArt from '../components/ProductArt.jsx';
import QuickActions from '../components/QuickActions.jsx';
import WeeklyStockOverview from '../components/WeeklyStockOverview.jsx';
import { PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import { useStaffRoster } from '../auth.js';
import { isoDate, toISODate } from '../store.js';

export default function Dashboard() {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();
    const role = session?.role || 'admin';
    const roster = useStaffRoster();

    // Imported rows with no opening stock are "awaiting stock", not sold out.
    const awaiting = state.products.filter((product) => product.awaiting_stock && productStock(product) <= 0);
    const outOfStock = state.products.filter((product) => productStock(product) <= 0 && !product.awaiting_stock);
    const lowStock = state.products.filter((product) => productStock(product) > 0 && productStatus(product) === 'Low Stock');
    const attentionStock = [...outOfStock, ...lowStock];
    const activeOrders = state.orders.filter((order) => order.status !== 'Cancelled');
    const cancelled = state.orders.filter((order) => order.status === 'Cancelled');
    const totalStock = state.products.reduce((sum, product) => sum + productStock(product), 0);
    const totalSales = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalQty = activeOrders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
    const cancelledValue = cancelled.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const salesTotal = state.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const salesQuantity = state.sales.reduce((sum, sale) =>
        sum + (sale.items || []).reduce((quantity, item) => quantity + Number(item.quantity || 0), 0), 0);
    const salesByDay = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const iso = isoDate(date);
        const total = state.sales
            .filter((sale) => (toISODate(sale.date) || toISODate(sale.created_at)) === iso)
            .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        return { iso, total };
    });
    const maxSales = Math.max(...salesByDay.map((day) => day.total), 1);

    return (
        <>
            <AdminWelcome />

            <PageHead
                title="Dashboard"
                subtitle={`Welcome back, ${session?.name || 'Admin'}! Here's what's happening with your store today.`}
            />

            <div className="dashboard-summary">
                <section className="dashboard-summary-section">
                    <header className="dashboard-summary-heading">
                        <span><i className="bi bi-box-seam"></i></span>
                        <div>
                            <h2>Inventory Overview</h2>
                            <p>Product availability and stock alerts</p>
                        </div>
                    </header>
                    <SummaryRow className="dashboard-stats">
                        <Stat tone="green" icon="bi-box-seam" label="Total Products" value={state.products.length} hint={`${awaiting.length} awaiting opening stock`} />
                        <Stat tone="blue" icon="bi-boxes" label="Total Stock" value={totalStock.toLocaleString('en-PH')} hint="Items available" />
                        <Stat tone="yellow" icon="bi-exclamation-triangle" label="Low Stock" value={lowStock.length} hint="Below minimum" />
                        <Stat tone="red" icon="bi-x-octagon" label="Out of Stock" value={outOfStock.length} hint="No units available" />
                    </SummaryRow>
                </section>

                <section className="dashboard-summary-section">
                    <header className="dashboard-summary-heading">
                        <span><i className="bi bi-cash-stack"></i></span>
                        <div>
                            <h2>Sales Overview</h2>
                            <p>Completed sales and cancelled transactions</p>
                        </div>
                    </header>
                    <SummaryRow className="dashboard-stats">
                        <Stat tone="green" icon="bi-cash-coin" label="Total Sales" value={money(salesTotal || totalSales)} hint="Completed receipts" />
                        <Stat tone="blue" icon="bi-stack" label="Quantity Sold" value={salesQuantity || totalQty} hint="Recorded units sold" />
                        <Stat tone="red" icon="bi-x-octagon" label="Cancelled Orders" value={cancelled.length} hint="Cancelled order count" />
                        <Stat tone="yellow" icon="bi-cash-stack" label="Cancelled Value" value={money(cancelledValue)} hint="Lost sales amount" />
                    </SummaryRow>
                </section>

                <section className="dashboard-summary-section dashboard-team-section">
                    <header className="dashboard-summary-heading">
                        <span><i className="bi bi-buildings"></i></span>
                        <div>
                            <h2>Business Accounts</h2>
                            <p>Supplier and staff records</p>
                        </div>
                    </header>
                    <SummaryRow className="dashboard-stats dashboard-team-stats">
                        <Stat tone="purple" icon="bi-truck" label="Total Suppliers" value={(state.suppliers || []).length} hint="Supplier accounts" />
                        <Stat tone="blue" icon="bi-person-badge" label="Active Staff" value={roster.length} hint="Configured staff accounts" />
                    </SummaryRow>
                </section>
            </div>

            <WeeklyStockOverview />

            <div className="dashboard-grid">
                <section className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-heading">
                        <div><h2>Sales Overview</h2><p>Completed sales from the last 7 days</p></div>
                        <Link to={`/${role}/sales-history`}>View sales history <i className="bi bi-arrow-right"></i></Link>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(70px, 1fr))', alignItems: 'end', gap: 12, minHeight: 180, padding: '20px 24px 24px' }}>
                        {salesByDay.map((day) => (
                            <div key={day.iso} style={{ textAlign: 'center' }}>
                                <strong style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>{money(day.total)}</strong>
                                <div style={{ height: `${Math.max(8, (day.total / maxSales) * 120)}px`, margin: '0 auto', maxWidth: 52, borderRadius: '8px 8px 2px 2px', background: '#2f8f46' }}></div>
                                <small style={{ display: 'block', marginTop: 8, color: '#718077' }}>{new Date(`${day.iso}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' })}</small>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="admin-panel low-stock-panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-heading">
                        <div>
                            <h2>Low Stock Products</h2>
                            <p>A few things need a restock</p>
                        </div>
                        <Link to={`/${role}/inventory`}>View all <i className="bi bi-arrow-right"></i></Link>
                    </div>
                    <div className="low-stock-list">
                        {attentionStock.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#718077', fontSize: 13 }}>
                                <i className="bi bi-check-circle" style={{ color: '#22c55e', fontSize: 24, display: 'block', marginBottom: 6 }}></i>
                                All stock levels are currently healthy!
                            </div>
                        ) : attentionStock.slice(0, 4).map((product) => (
                            <div className="low-stock-row" key={product.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/${role}/inventory`)}>
                                <ProductArt product={product} className="product-thumb" />
                                <span>
                                    <b>{product.name}</b>
                                    <small>{product.category} · Min. {product.minimum} {unitShort(product.unit)}</small>
                                </span>
                                <span className="stock-amount">
                                    {variantsOf(product).map((variant) => `${variant.stock} ${unitShort(variant.unit)}`).join(' / ')}
                                    <small>left</small>
                                </span>
                                <span className={`stock-alert${productStock(product) === 0 ? ' empty' : ''}`}>
                                    <i className="bi bi-exclamation-circle-fill"></i> {productStock(product) === 0 ? 'Out' : 'Low'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <QuickActions />
        </>
    );
}
