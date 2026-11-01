import { Link } from 'react-router-dom';
import { isoDate, stockState, useStore } from '../store.js';
import { totalStock as productStock, unitShort, variantsOf } from '../products.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';

export default function InventoryStaffDashboard() {
    const state = useStore();
    const session = useSession();
    const today = isoDate();
    // Imported rows still waiting for opening stock are not "low stock" - they
    // have simply never been stocked. Inventory shows them separately.
    const lowStock = state.products.filter((product) => stockState(product) !== 'In Stock'
        && !(product.awaiting_stock && productStock(product) <= 0));
    const awaiting = state.products.filter((product) => product.awaiting_stock && productStock(product) <= 0);
    const expired = state.products.filter((product) => product.expiration_date && product.expiration_date <= today);
    const issueProductIds = new Set([
        ...expired.map((product) => product.id),
        ...(state.inventoryIssues || []).map((issue) => issue.product_id),
    ]);
    const totalStock = state.products.reduce((sum, product) => sum + productStock(product), 0);

    return (
        <>
            <PageHead
                kicker={`Welcome, ${session?.name || 'Staff'}`}
                title="Inventory Staff Dashboard"
                subtitle="Monitor stock levels, incoming and outgoing movements, and product expiry."
            />
            <SummaryRow className="dashboard-stats">
                <Stat tone="green" icon="bi-box-seam" label="Total Products" value={state.products.length} hint="Catalogued products" />
                <Stat tone="blue" icon="bi-boxes" label="Total Stock Units" value={totalStock.toLocaleString('en-PH')} hint="Available quantity" />
                <Stat tone="yellow" icon="bi-exclamation-triangle" label="Low-Stock Products" value={lowStock.length} hint={`${awaiting.length} awaiting opening stock`} />
                <Stat tone="red" icon="bi-calendar2-x" label="Expired / Damaged" value={issueProductIds.size} hint="Products requiring review" />
            </SummaryRow>

            <div className="quick-actions inventory-quick-actions">
                <Link to="/inventory-staff/stock-in"><i className="bi bi-box-arrow-in-down"></i><span><b>Record Stock In</b><small>Update a delivery</small></span><i className="bi bi-arrow-right"></i></Link>
                <Link to="/inventory-staff/stock-out"><i className="bi bi-box-arrow-up"></i><span><b>Record Stock Out</b><small>Document a movement</small></span><i className="bi bi-arrow-right"></i></Link>
                <Link to="/inventory-staff/expiration"><i className="bi bi-calendar2-week"></i><span><b>Expiration Monitoring</b><small>Review upcoming dates</small></span><i className="bi bi-arrow-right"></i></Link>
                <Link to="/inventory-staff/damaged-expired"><i className="bi bi-exclamation-diamond"></i><span><b>Damaged / Expired</b><small>Record removed products</small></span><i className="bi bi-arrow-right"></i></Link>
            </div>

            <section className="admin-panel">
                <div className="panel-heading">
                    <div><h2>Stock Requiring Attention</h2><p>Low or out-of-stock products, ordered by remaining quantity.</p></div>
                    <Link to="/inventory-staff/low-stock">View low stock <i className="bi bi-arrow-right"></i></Link>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Product</th><th>Category</th><th>On Hand</th><th>Minimum</th><th>Updated</th></tr></thead>
                        <tbody>
                            {lowStock.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-check2-circle" title="Stock levels are healthy" body="Products at or below minimum will appear here." /></td></tr>
                            ) : lowStock.slice().sort((a, b) => productStock(a) - productStock(b)).slice(0, 8).map((product) => (
                                <tr key={product.id}>
                                    <td><b>{product.name}</b></td><td>{product.category}</td>
                                    <td className={productStock(product) === 0 ? 'negative-cell' : 'strong-cell'}>
                                        <span className="stock-chips">
                                            {variantsOf(product).map((variant) => (
                                                <span key={variant.key} className="stock-chip">{variant.stock} {unitShort(variant.unit)}</span>
                                            ))}
                                        </span>
                                    </td>
                                    <td>{product.minimum} {unitShort(product.unit)}</td><td>{product.updated || 'Recent'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
