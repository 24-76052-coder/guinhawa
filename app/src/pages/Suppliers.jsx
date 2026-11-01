import { useMemo, useState } from 'react';
import { useSession } from '../auth.js';
import { store, useStore } from '../store.js';
import { confirmAction, formDialog, showError, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';

export default function Suppliers() {
    const state = useStore();
    const session = useSession();
    const [query, setQuery] = useState('');
    const deliveries = state.supplierDeliveries || [];

    const filtered = state.suppliers.filter((supplier) => {
        const keyword = query.trim().toLowerCase();
        return !keyword || [supplier.name, supplier.contact, supplier.email, supplier.address]
            .some((field) => String(field || '').toLowerCase().includes(keyword));
    });

    const deliveryCount = useMemo(() => deliveries.length, [deliveries]);

    async function addSupplier() {
        try {
            const values = await formDialog({
                title: 'Add Supplier',
                fields: [
                    { name: 'name', label: 'Supplier Name', required: true },
                    { name: 'contact', label: 'Contact Number', required: true },
                    { name: 'email', label: 'Email Address', type: 'email' },
                    { name: 'address', label: 'Address', value: 'Malolos, Bulacan' },
                ],
                confirmText: 'Add Supplier',
                validate: (entry) => entry.name?.trim() && entry.contact?.trim() ? undefined : 'Supplier name and contact number are required.',
            });
            if (!values) return;
            store.addSupplier(values);
            toast('Supplier added.');
        } catch (error) {
            showError(error);
        }
    }

    async function editSupplier(supplier) {
        try {
            const values = await formDialog({
                title: `Edit ${supplier.name}`,
                fields: [
                    { name: 'name', label: 'Supplier Name', value: supplier.name, required: true },
                    { name: 'contact', label: 'Contact Number', value: supplier.contact, required: true },
                    { name: 'email', label: 'Email Address', type: 'email', value: supplier.email },
                    { name: 'address', label: 'Address', value: supplier.address },
                ],
                confirmText: 'Save Changes',
            });
            if (!values) return;
            await store.updateSupplier(supplier.id, values);
            toast('Supplier updated.');
        } catch (error) {
            showError(error);
        }
    }

    async function removeSupplier(supplier) {
        const confirmed = await confirmAction({
            title: 'Remove supplier?',
            text: `${supplier.name} will be removed from supplier records. Existing delivery history will remain.`,
            confirmText: 'Remove',
        });
        if (!confirmed) return;
        try {
            await store.removeSupplier(supplier.id);
            toast('Supplier removed.');
        } catch (error) {
            showError(error);
        }
    }

    async function recordDelivery() {
        if (!state.suppliers.length || !state.products.length) {
            showError(new Error('Add a supplier and product before recording a delivery.'));
            return;
        }
        try {
            const values = await formDialog({
                title: 'Record Supplier Delivery',
                fields: [
                    { name: 'supplier_id', label: 'Supplier', type: 'select', options: state.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })) },
                    { name: 'product_id', label: 'Product', type: 'select', options: state.products.map((product) => ({ value: String(product.id), label: product.name })) },
                    { name: 'quantity', label: 'Delivered Quantity', type: 'number', min: 1, step: '0.01', required: true },
                    { name: 'movement_unit', label: 'Unit', type: 'select', options: ['Sacks', 'Bags', 'Kilograms', 'Pieces', 'Bottles', 'Boxes', 'Packs'] },
                    { name: 'reference', label: 'Delivery Reference', placeholder: 'Leave blank to auto-generate' },
                    { name: 'remarks', label: 'Remarks', type: 'textarea' },
                ],
                confirmText: 'Record Delivery',
                validate: (entry) => Number(entry.quantity) > 0 ? undefined : 'Delivered quantity must be greater than zero.',
            });
            if (!values) return;
            await store.recordSupplierDelivery({
                ...values,
                supplier_id: String(values.supplier_id),
                product_id: Number(values.product_id),
                quantity: Number(values.quantity),
                user: session?.username || 'unknown',
            });
            toast('Supplier delivery recorded and inventory updated.');
        } catch (error) {
            showError(error);
        }
    }

    return (
        <>
            <PageHead
                title="Suppliers"
                subtitle="Manage supplier contacts and record incoming deliveries."
                actions={
                    <div className="table-actions">
                        <button className="admin-soft" type="button" onClick={recordDelivery}><i className="bi bi-truck"></i> Record Delivery</button>
                        <button className="admin-primary" type="button" onClick={addSupplier}><i className="bi bi-plus-lg"></i> Add Supplier</button>
                    </div>
                }
            />
            <SummaryRow>
                <Stat tone="green" icon="bi-truck" label="Suppliers" value={state.suppliers.length} />
                <Stat tone="blue" icon="bi-box-arrow-in-down" label="Deliveries Recorded" value={deliveryCount} />
                <Stat tone="yellow" icon="bi-boxes" label="Units Delivered" value={deliveries.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} />
            </SummaryRow>
            <div className="admin-toolbar">
                <label className="admin-search"><i className="bi bi-search"></i><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers..." /></label>
            </div>
            <div className="admin-panel">
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Supplier</th><th>Contact</th><th>Email</th><th>Address</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-truck" title="No suppliers found" body="Add a supplier or change the search." /></td></tr>
                            ) : filtered.map((supplier) => (
                                <tr key={supplier.id}>
                                    <td><b>{supplier.name}</b></td><td>{supplier.contact}</td><td>{supplier.email || '—'}</td><td>{supplier.address || '—'}</td>
                                    <td><div className="table-actions"><button className="admin-soft" type="button" onClick={() => editSupplier(supplier)}><i className="bi bi-pencil"></i> Edit</button><button className="admin-soft" type="button" onClick={() => removeSupplier(supplier)}><i className="bi bi-trash"></i> Remove</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="admin-panel" style={{ marginTop: 16 }}>
                <div className="panel-heading"><div><h2>Delivery Records</h2><p>All recorded supplier deliveries and stock updates.</p></div></div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Supplier</th><th>Product</th><th>Quantity</th><th>Unit</th><th>Reference</th><th>Recorded By</th></tr></thead>
                        <tbody>
                            {deliveries.length === 0 ? (
                                <tr><td colSpan="7"><EmptyState icon="bi-truck" title="No delivery records" body="Use Record Delivery to add the first supplier delivery." /></td></tr>
                            ) : deliveries.map((delivery) => (
                                <tr key={delivery.id}>
                                    <td>{delivery.date}</td><td><b>{delivery.supplier}</b></td><td>{delivery.product}</td>
                                    <td className="strong-cell">{delivery.quantity}</td><td>{delivery.unit}</td><td>{delivery.reference}</td><td>{delivery.user}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
