import { useNavigate } from 'react-router-dom';
import { money, useStore } from '../store.js';
import { stockState, totalStock, unitShort, variantsOf } from '../products.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Stat, StatusBadge, SummaryRow } from '../components/ui.jsx';
import OpenInventoryButton from '../buttons/inventory/OpenInventoryButton.jsx';

/** Products at or below their minimum - the restock list for the counter. */
export default function LowStock() {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();
    const role = session?.role || 'inventory-staff';

    // Freshly imported products sit at zero stock because opening stock has not
    // been entered yet. They belong on Inventory, not on the restock list, so
    // only products that have actually been stocked and then ran low appear.
    const flagged = state.products
        .filter((product) => stockState(product) !== 'In Stock'
            && !(product.awaiting_stock && totalStock(product) <= 0))
        .sort((a, b) => totalStock(a) - totalStock(b));

    const out = flagged.filter((product) => totalStock(product) === 0);
    const low = flagged.filter((product) => totalStock(product) > 0);
    const missing = flagged.reduce((sum, product) => sum + Math.max(0, product.minimum - Number(product.stock || 0)), 0);
    const value = flagged.reduce((sum, product) => sum + Math.max(0, product.minimum - Number(product.stock || 0)) * Number(product.price || 0), 0);

    return (
        <>
            <PageHead
                title="Low Stock"
                subtitle="Everything at or below its minimum level, so you know what to reorder first."
            />

            <SummaryRow>
                <Stat tone="red" icon="bi-x-octagon" label="Out of Stock" value={out.length} hint="Nothing left to sell" trend="down" />
                <Stat tone="yellow" icon="bi-exclamation-triangle" label="Low Stock" value={low.length} hint="Below the minimum" trend="down" />
                <Stat tone="blue" icon="bi-boxes" label="Units to Reorder" value={missing} hint="To reach the minimum" />
                <Stat tone="green" icon="bi-cash-coin" label="Reorder Value" value={money(value)} hint="Cost to restock" />
            </SummaryRow>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Restock List</h2>
                        <p>{flagged.length} product{flagged.length === 1 ? '' : 's'} need{flagged.length === 1 ? 's' : ''} attention</p>
                    </div>
                    <OpenInventoryButton onClick={() => navigate(`/${role}/inventory`)} />
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th><th>Category</th><th>On hand</th><th>Minimum</th>
                                <th>Missing</th><th>Selling price</th><th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flagged.length === 0 ? (
                                <tr>
                                    <td colSpan="7">
                                        <EmptyState
                                            icon="bi-check2-circle"
                                            title="All stock levels are healthy!"
                                            body="Every stocked product is above its minimum. New low stock alerts will appear here."
                                        />
                                    </td>
                                </tr>
                            ) : flagged.map((product) => {
                                const onHand = variantsOf(product).map((variant) => `${variant.stock} ${unitShort(variant.unit)}`).join(' / ');
                                const missingQty = Math.max(0, product.minimum - Number(product.stock || 0));
                                return (
                                    <tr key={product.id} className="clickable-row" onClick={() => navigate(`/${role}/inventory`)}>
                                        <td><b>{product.name}</b><small className="cell-sub">{product.subcategory || product.brand || '—'}</small></td>
                                        <td>{product.category}</td>
                                        <td className="strong-cell">{onHand}</td>
                                        <td>{product.minimum} {unitShort(product.unit)}</td>
                                        <td className={totalStock(product) === 0 ? 'negative-cell' : 'muted-cell'}>
                                            {missingQty}
                                        </td>
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
                                        <td><StatusBadge value={stockState(product)} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
