import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../auth.js';
import { formDialog, showError, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import { isoDate, store, useStore } from '../store.js';
import { totalStock, unitShort, variantsOf } from '../products.js';

function daysUntil(date) {
    const expiry = new Date(`${date}T00:00:00`);
    const today = new Date(`${isoDate()}T00:00:00`);
    return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

function splitChoice(value) {
    const [productId, variantKey] = String(value || '').split(':');
    return { productId: Number(productId), variantKey: variantKey || 'A' };
}

export function ExpirationMonitoring() {
    const state = useStore();
    const [query, setQuery] = useState('');
    const tracked = state.products.filter((product) => Boolean(product.expiration_date));
    const filtered = tracked.filter((product) => {
        const keyword = query.trim().toLowerCase();
        return !keyword || [product.name, product.category, product.subcategory, product.brand, product.supplier, product.sku, product.barcode]
            .some((value) => String(value || '').toLowerCase().includes(keyword));
    }).sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));
    const expired = tracked.filter((product) => daysUntil(product.expiration_date) < 0).length;
    const near = tracked.filter((product) => daysUntil(product.expiration_date) >= 0 && daysUntil(product.expiration_date) <= 30).length;

    return (
        <>
            <PageHead title="Expiration Monitoring" subtitle="Track products with recorded expiry dates and prioritize items approaching expiry." actions={<Link className="admin-soft" to="/inventory-staff/products"><i className="bi bi-box-seam"></i> Manage product dates</Link>} />
            <SummaryRow>
                <Stat tone="blue" icon="bi-calendar2-week" label="Dates Recorded" value={tracked.length} hint="Products with an expiry date" />
                <Stat tone="yellow" icon="bi-clock-history" label="Expiring in 30 Days" value={near} hint="Review and rotate stock" />
                <Stat tone="red" icon="bi-calendar2-x" label="Past Expiration" value={expired} hint="Review and record removal" />
            </SummaryRow>
            <div className="admin-toolbar">
                <label className="admin-search"><i className="bi bi-search"></i><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, brand or supplier..." /></label>
            </div>
            <div className="admin-panel">
                <div className="panel-heading"><div><h2>Expiration Dates</h2><p>Products with no date assigned can be updated from Products.</p></div></div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Product</th><th>Category</th><th>Available Stock</th><th>Expiration Date</th><th>Review Status</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-calendar2-check" title="No expiration dates recorded" body="Use Products to add expiry dates to the relevant inventory records." /></td></tr>
                            ) : filtered.map((product) => {
                                const days = daysUntil(product.expiration_date);
                                const status = days < 0 ? 'Expired' : days <= 30 ? `Expires in ${days} days` : 'Within date';
                                return (
                                    <tr key={product.id}>
                                        <td><b>{product.name}</b><small className="cell-sub">{product.subcategory || product.brand || '—'}</small></td>
                                        <td>{product.category}</td>
                                        <td>
                                            <span className="stock-chips">
                                                {variantsOf(product).map((variant) => (
                                                    <span key={variant.key} className="stock-chip">
                                                        {variant.stock} {unitShort(variant.unit)}
                                                    </span>
                                                ))}
                                            </span>
                                        </td>
                                        <td>{product.expiration_date}</td>
                                        <td><span className={`status-badge ${days < 0 ? 'out-of-stock' : days <= 30 ? 'low-stock' : 'in-stock'}`}><i></i>{status}</span></td>
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

export function DamagedExpired() {
    const state = useStore();
    const session = useSession();
    const [query, setQuery] = useState('');
    const issues = state.inventoryIssues || [];
    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        return issues.filter((issue) => !keyword || [issue.product, issue.reason, issue.staff_id, issue.reference, issue.remarks, issue.unit]
            .some((value) => String(value || '').toLowerCase().includes(keyword)));
    }, [issues, query]);

    async function recordIssue() {
        const options = state.products.flatMap((product) => variantsOf(product)
            .filter((variant) => Number(variant.stock) > 0)
            .map((variant) => ({
                value: `${product.id}:${variant.key}`,
                label: `${product.name} — ${variant.unit} (${variant.stock} ${unitShort(variant.unit)} available)`,
            })));
        if (!options.length) {
            showError(new Error('There are no products with stock available to record.'));
            return;
        }
        try {
            const values = await formDialog({
                title: 'Record Damaged or Expired Products',
                fields: [
                    { name: 'product_variant', label: 'Product and selling unit', type: 'select', options, value: options[0].value },
                    { name: 'quantity', label: 'Quantity to remove', type: 'number', min: 0, step: '0.01', value: 1, required: true },
                    { name: 'reason', label: 'Reason', type: 'select', options: ['Damaged', 'Expired'], value: 'Damaged' },
                    { name: 'remarks', label: 'Details / Notes', type: 'textarea', placeholder: 'Describe the condition or disposal notes' },
                ],
                confirmText: 'Record and Remove Stock',
                validate: (entry) => {
                    const { productId, variantKey } = splitChoice(entry.product_variant);
                    const product = state.products.find((item) => item.id === productId);
                    if (!product) return 'Please select a product.';
                    const variant = variantsOf(product).find((item) => item.key === variantKey);
                    if (!variant) return 'Please select a selling unit.';
                    const quantity = Number(entry.quantity);
                    if (!Number.isFinite(quantity) || quantity <= 0) return 'Quantity must be greater than zero.';
                    if (quantity > Number(variant.stock)) return `Only ${variant.stock} ${unitShort(variant.unit)} are available.`;
                    return '';
                },
            });
            if (!values) return;
            const { productId, variantKey } = splitChoice(values.product_variant);
            await store.recordInventoryIssue({
                product_id: productId,
                variant: variantKey,
                quantity: Number(values.quantity),
                reason: values.reason,
                remarks: values.remarks,
                user: session?.username || 'unknown',
            });
            toast('Issue recorded and available stock updated.');
        } catch (error) {
            showError(error);
        }
    }

    const removed = issues.reduce((sum, issue) => sum + Number(issue.quantity || 0), 0);

    return (
        <>
            <PageHead title="Damaged / Expired Products" subtitle="Record product losses and remove affected quantities from available inventory." actions={<button type="button" className="admin-primary" onClick={recordIssue}><i className="bi bi-plus-lg"></i> Record Product Issue</button>} />
            <SummaryRow>
                <Stat tone="red" icon="bi-exclamation-diamond" label="Recorded Issues" value={issues.length} hint="Damaged and expired entries" />
                <Stat tone="yellow" icon="bi-box-arrow-up" label="Units Removed" value={removed} hint="Removed from available stock" />
                <Stat tone="blue" icon="bi-person-badge" label="Staff Records" value={new Set(issues.map((issue) => issue.staff_id)).size} hint="Responsible staff IDs" />
            </SummaryRow>
            <div className="admin-toolbar">
                <label className="admin-search"><i className="bi bi-search"></i><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, reason, staff ID, or reference..." /></label>
            </div>
            <div className="admin-panel">
                <div className="panel-heading"><div><h2>Issue History</h2><p>Each entry also appears in inventory history.</p></div></div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Unit</th><th>Reason</th><th>Details</th><th>Staff ID</th><th>Reference</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="8"><EmptyState icon="bi-check2-circle" title="No damaged or expired products recorded" body="Record a product issue to remove its quantity from stock and create an audit entry." /></td></tr>
                            ) : filtered.map((issue) => (
                                <tr key={issue.id}>
                                    <td>{issue.date}</td><td><b>{issue.product}</b></td><td>{issue.quantity}</td>
                                    <td>{issue.unit || 'Units'}</td>
                                    <td>{issue.reason}</td><td>{issue.remarks || '—'}</td><td>{issue.staff_id}</td><td>{issue.reference}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
