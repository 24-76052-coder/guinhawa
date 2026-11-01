import { useState } from 'react';
import { store, useStore } from '../store.js';
import { confirmAction, formDialog, showError, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, StatusBadge } from '../components/ui.jsx';
import AddCustomerButton from '../buttons/admin/AddCustomerButton.jsx';
import DeleteRowButton from '../buttons/staff/DeleteRowButton.jsx';
import EditRowButton from '../buttons/staff/EditRowButton.jsx';
import ViewRowButton from '../buttons/staff/ViewRowButton.jsx';
import Swal from 'sweetalert2';

function initialsOf(name) {
    return String(name).split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

const FIELDS = (customer) => [
    { name: 'name', label: 'Full Name', value: customer?.name || '', required: true, placeholder: 'e.g. Juan Dela Cruz' },
    { name: 'contact', label: 'Contact Number', value: customer?.contact || '', required: true, placeholder: '09XX XXX XXXX' },
    { name: 'email', label: 'Email Address', type: 'email', value: customer?.email || '' },
    { name: 'address', label: 'Address', value: customer?.address || '' },
];

export default function Customers() {
    const state = useStore();
    const [query, setQuery] = useState('');

    const filtered = state.customers.filter((customer) => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        return [customer.name, customer.id, customer.contact, customer.email, customer.address]
            .some((field) => String(field || '').toLowerCase().includes(keyword));
    });

    async function addCustomer() {
        try {
            const values = await formDialog({ title: 'Add New Customer', fields: FIELDS(null), confirmText: 'Add Customer' });
            if (!values) return;
            await store.addCustomer(values);
            toast('Customer added.');
        } catch (error) {
            showError(error);
        }
    }

    async function editCustomer(customer) {
        try {
            const values = await formDialog({ title: `Edit ${customer.name}`, fields: FIELDS(customer), confirmText: 'Save Changes' });
            if (!values) return;
            await store.updateCustomer(customer.id, values);
            toast('Customer updated.');
        } catch (error) {
            showError(error);
        }
    }

    async function deleteCustomer(customer) {
        const ok = await confirmAction({
            title: 'Delete customer?',
            text: `${customer.name} will be removed from your directory.`,
            confirmText: 'Delete',
        });
        if (!ok) return;
        try {
            await store.removeCustomer(customer.id);
            toast('Customer deleted.');
        } catch (error) {
            showError(error);
        }
    }

    function viewCustomer(customer) {
        const orders = state.orders.filter((order) => order.customer === customer.name);
        Swal.fire({
                title: customer.name,
                html: `
                    <div class="detail-modal">
                        <div><span>Customer ID</span><b>${customer.id}</b></div>
                        <div><span>Contact</span><b>${customer.contact}</b></div>
                        <div><span>Email</span><b>${customer.email}</b></div>
                        <div><span>Total Orders</span><b>${customer.orders ?? 0}</b></div>
                        <div><span>Last Order</span><b>${customer.last || 'Recent'}</b></div>
                        <div><span>Status</span><b><span class="status-badge active"><i></i>${customer.status || 'Active'}</span></b></div>
                        <div style="grid-column: 1 / -1;"><span>Address</span><p style="margin: 2px 0 0; font-size: 13px; color: #405643;">${customer.address || 'No address on file.'}</p></div>
                        <div style="grid-column: 1 / -1;"><span>Open orders</span><p style="margin: 2px 0 0; font-size: 13px; color: #405643;">${orders.length ? orders.map((order) => `${order.id} · ${order.product}`).join('<br>') : 'No open orders.'}</p></div>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Edit',
                cancelButtonText: 'Close',
                confirmButtonColor: '#166534',
                cancelButtonColor: '#718077',
            }).then((result) => { if (result.isConfirmed) editCustomer(customer); });
    }

    return (
        <>
            <PageHead
                title="Customers"
                subtitle="Manage your poultry supply customers and contact records."
                actions={<AddCustomerButton onClick={addCustomer} />}
            />

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input type="text" placeholder="Search customers by name, phone, or ID..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Customer Directory</h2>
                        <p>{filtered.length} customer{filtered.length === 1 ? '' : 's'}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer ID</th><th>Name</th><th>Contact</th><th>Email</th>
                                <th>Total Orders</th><th>Last Order</th><th>Status</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <EmptyState icon="bi-people" title="No customers found" body="Add your first customer to start tracking orders." />
                                    </td>
                                </tr>
                            ) : filtered.map((customer) => (
                                <tr key={customer.id}>
                                    <td className="muted-cell">{customer.id}</td>
                                    <td>
                                        <div className="customer-cell">
                                            <span>{initialsOf(customer.name)}</span>
                                            <b>{customer.name}</b>
                                        </div>
                                    </td>
                                    <td>{customer.contact}</td>
                                    <td>{customer.email}</td>
                                    <td>{customer.orders ?? 0}</td>
                                    <td>{customer.last || 'Recent'}</td>
                                    <td><StatusBadge value={customer.status || 'Active'} /></td>
                                    <td>
                                        <div className="table-actions">
                                            <ViewRowButton title="View customer" onClick={() => viewCustomer(customer)} />
                                            <EditRowButton title="Edit customer" onClick={() => editCustomer(customer)} />
                                            <DeleteRowButton title="Delete customer" onClick={() => deleteCustomer(customer)} />
                                        </div>
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
