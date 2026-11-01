import { useState } from 'react';
import { store, useStore } from '../store.js';
import { unitShort, variantsOf } from '../products.js';
import { useSession } from '../auth.js';
import { formDialog, notify, showError, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import StockSubmitButton from '../buttons/inventory/StockSubmitButton.jsx';
import ViewDetailsButton from '../buttons/inventory/ViewDetailsButton.jsx';

/**
 * The Stock In and Stock Out screens share every piece of structure - only the
 * wording, the summary figures and the extra dialog fields differ, so both
 * routes render this one component.
 *
 * A movement targets one selling unit (Price A or Price B), never a blend of
 * both, so a sack count is never added to a kilogram count.
 */

function splitChoice(value) {
    const [productId, variantKey] = String(value || '').split(':');
    return { productId: Number(productId), variantKey: variantKey || 'A' };
}

function StockMovementPage({ action }) {
    const isIn = action === 'Stock In';
    const state = useStore();
    const session = useSession();
    const [query, setQuery] = useState('');

    const moves = state.stockMoves.filter((move) => isIn
        ? move.action === action
        : ['Stock Out', 'Damaged', 'Expired'].includes(move.action));
    const filtered = moves.filter((move) => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        return [move.product, move.reference, move.remarks, move.user, move.unit]
            .some((field) => String(field || '').toLowerCase().includes(keyword));
    });

    const total = moves.reduce((sum, move) => sum + move.quantity, 0);
    const latest = moves[0];
    const mixedUnits = new Set(moves.map((move) => move.unit || 'Units')).size > 1;

    const titles = isIn
        ? {
              kicker: 'Stock In',
              subtitle: 'Record products received from suppliers and update stock levels.',
              panelTitle: 'Recent Stock In Entries',
              panelCopy: 'Your latest inventory intake movements',
              placeholder: 'Search stock-in records...',
              button: 'New Stock In',
              empty: 'No stock-in records yet.',
              customerLabel: 'Supplier / Remarks',
              userLabel: 'Added By',
          }
        : {
              kicker: 'Stock Out',
              subtitle: 'Record products removed from inventory for customer orders or usage.',
              panelTitle: 'Recent Stock Out Entries',
              panelCopy: 'Your latest inventory deductions and sales',
              placeholder: 'Search stock-out records...',
              button: 'New Stock Out',
              empty: 'No stock-out records yet.',
              customerLabel: 'Customer / Reason',
              userLabel: 'Recorded By',
          };

    async function record() {
        try {
            const allProductOptions = state.products.flatMap((product) => variantsOf(product).map((variant) => ({
                value: `${product.id}:${variant.key}`,
                label: `${product.name} — ${variant.unit} (${variant.stock} ${unitShort(variant.unit)} left)`,
            })));

            const fields = [
                {
                    name: 'product_variant',
                    label: 'Product and selling unit',
                    type: 'search-select',
                    hint: 'Search a product name, then choose the unit.',
                    searchPlaceholder: 'Search product or selling unit...',
                    options: allProductOptions,
                    value: allProductOptions[0]?.value
                },
                {
                    name: 'quantity',
                    label: isIn ? 'Quantity received' : 'Quantity removed',
                    hint: isIn ? 'Enter the number added to inventory.' : 'Enter the number removed from inventory.',
                    type: 'number',
                    min: 0,
                    step: '0.01',
                    value: 1,
                    required: true,
                },
            ];
            if (isIn) {
                fields.push(
                    { name: 'supplier', label: 'Supplier', value: state.suppliers[0]?.name || '' },
                    { name: 'remarks', label: 'Remarks', placeholder: 'Optional notes' },
                    { name: 'reference', label: 'Reference No.', placeholder: 'Leave blank to auto-generate' },
                );
            } else {
                fields.push(
                    { name: 'customer', label: 'Customer', value: 'Walk-in Customer' },
                    { name: 'reason', label: 'Reason', type: 'select', options: ['Customer Order', 'Usage', 'Damaged', 'Expired', 'Transfer'], value: 'Customer Order' },
                    { name: 'remarks', label: 'Remarks', placeholder: 'Optional notes' },
                    { name: 'reference', label: 'Reference No.', placeholder: 'Leave blank to auto-generate' },
                );
            }

            const values = await formDialog({
                title: titles.button,
                fields,
                confirmText: titles.button,
                validate: (entry) => {
                    const { productId, variantKey } = splitChoice(entry.product_variant);
                    const product = state.products.find((item) => item.id === productId);
                    if (!product) return 'Please choose a product.';
                    const variant = variantsOf(product).find((item) => item.key === variantKey);
                    if (!variant) return 'Please choose a selling unit.';
                    const quantity = Number(entry.quantity);
                    if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be greater than zero.';
                    if (!isIn && quantity > Number(variant.stock)) {
                        return `Only ${variant.stock} ${unitShort(variant.unit)} of ${product.name} available.`;
                    }
                    return undefined;
                },
            });
            if (!values) return;

            const { productId, variantKey } = splitChoice(values.product_variant);
            const args = {
                ...values,
                product_id: productId,
                variant: variantKey,
                quantity: Number(values.quantity),
                user: session?.username || 'unknown',
            };
            if (isIn) {
                const supplierRecord = state.suppliers.find((supplier) => supplier.name === values.supplier);
                if (supplierRecord) {
                    await store.recordSupplierDelivery({
                        ...args,
                        supplier_id: supplierRecord.id,
                        supplier: supplierRecord.name,
                    });
                } else {
                    await store.stockIn(args);
                }
            } else {
                await store.stockOut(args);
            }
            toast(`${action} recorded.`);
        } catch (error) {
            showError(error);
        }
    }

    function details(move) {
        notify(move.reference, `${move.action} \u00b7 ${move.product} \u00b7 ${move.quantity} ${unitShort(move.unit)} \u00b7 ${move.remarks || 'No remarks'}`, 'info');
    }

    return (
        <>
            <PageHead
                title={titles.kicker}
                subtitle={titles.subtitle}
                actions={<StockSubmitButton stockIn={isIn} label={titles.button} onClick={record} />}
            />

            <SummaryRow>
                <Stat tone={isIn ? 'green' : 'red'} icon={isIn ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'} label={isIn ? 'Latest Receipt' : 'Latest Removal'} value={latest ? `${latest.quantity} ${unitShort(latest.unit)}` : '0'} />
                <Stat tone="blue" icon="bi-boxes" label={isIn ? 'Total Quantity Added' : 'Total Quantity Out'} value={total.toLocaleString('en-PH')} hint={mixedUnits ? 'Mixed selling units' : undefined} />
                <Stat tone="yellow" icon="bi-clock-history" label="Recent Entries" value={moves.length} />
            </SummaryRow>

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input type="text" placeholder={titles.placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>{titles.panelTitle}</h2>
                        <p>{titles.panelCopy}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th><th>Product</th><th>Quantity</th><th>Unit</th>
                                <th>{titles.customerLabel}</th><th>Reference</th><th>{titles.userLabel}</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <EmptyState icon="bi-clock-history" title={titles.empty} body="Record your first movement with the button above." />
                                    </td>
                                </tr>
                            ) : filtered.map((move) => (
                                <tr key={move.id}>
                                    <td>{move.date}</td>
                                    <td><b>{move.product}</b></td>
                                    <td className={isIn ? 'positive-cell' : ''}>{move.quantity}</td>
                                    <td>{move.unit || 'Units'}</td>
                                    <td>{move.remarks || (isIn ? 'Supplier Delivery' : '\u2014')}</td>
                                    <td>{move.reference}</td>
                                    <td>{move.user}</td>
                                    <td>
                                        <ViewDetailsButton title="View details" onClick={() => details(move)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

export function StockInPage() {
    return <StockMovementPage action="Stock In" />;
}

export function StockOutPage() {
    return <StockMovementPage action="Stock Out" />;
}

export default StockMovementPage;
