import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { money, store, useStore, ORDER_STATUSES } from '../store.js';
import { showError, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, Stat, StatusBadge, SummaryRow } from '../components/ui.jsx';
import OrderFilterButton from '../buttons/admin/OrderFilterButton.jsx';
import ViewOrderButton from '../buttons/admin/ViewOrderButton.jsx';
import Swal from 'sweetalert2';

const PILLS = ['All', ...ORDER_STATUSES];

export default function Orders() {
    const state = useStore();
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.get('q') || '';
    const [query, setQuery] = useState(urlQuery);
    const [pill, setPill] = useState('All');

    useEffect(() => {
        setQuery(urlQuery);
    }, [urlQuery]);

    const active = state.orders.filter((order) => order.status !== 'Cancelled');
    const cancelled = state.orders.filter((order) => order.status === 'Cancelled');
    const totalSales = active.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const totalQty = active.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
    const cancelledQty = cancelled.reduce((sum, order) => sum + Number(order.quantity || 0), 0);

    const filtered = state.orders.filter((order) => {
        const matchesPill = pill === 'All' || order.status === pill;
        const keyword = query.trim().toLowerCase();
        const matchesQuery = !keyword
            || [order.customer, order.product, order.id].some((field) => String(field || '').toLowerCase().includes(keyword));
        return matchesPill && matchesQuery;
    });

    function viewOrder(order) {
        Swal.fire({
                title: `Order #${order.id}`,
                html: `
                    <div class="detail-modal">
                        <div><span>Customer</span><b>${order.customer}</b></div>
                        <div><span>Product</span><b>${order.product}</b></div>
                        <div><span>Quantity</span><b>${order.quantity}</b></div>
                        <div><span>Total</span><b>${money(order.total)}</b></div>
                        <div><span>Date</span><b>${order.date}</b></div>
                        <div><span>Status</span><b><span class="status-badge ${order.status.toLowerCase()}"><i></i>${order.status}</span></b></div>
                        <div style="grid-column: 1 / -1;"><span>Message</span><p style="margin: 2px 0 0; font-size: 13px; color: #405643;">${order.message || 'No message.'}</p></div>
                        <label class="admin-swal-field" style="grid-column: 1 / -1;">Update status
                            <select class="swal2-select" id="orderStatusSelect" name="status">
                                ${ORDER_STATUSES.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`).join('')}
                            </select>
                        </label>
                    </div>`,
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'Save status',
                denyButtonText: 'Close',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#166534',
                denyButtonColor: '#718077',
                cancelButtonColor: '#a3ada5',
                preConfirm: () => document.getElementById('orderStatusSelect').value,
            }).then(async (result) => {
                if (!result.isConfirmed) return;
                try {
                    await store.setOrderStatus(order.id, result.value);
                    toast('Order status updated.');
                } catch (error) {
                    showError(error);
                }
            });
    }

    return (
        <>
            <PageHead title="Orders" subtitle="Manage customer orders and inquiries received through your store." />

            <SummaryRow>
                <Stat tone="green" icon="bi-cash-coin" label="Total Sales" value={money(totalSales)} hint="Excluding cancelled orders" />
                <Stat tone="blue" icon="bi-stack" label="Quantity Sold" value={totalQty} hint="Units ordered" />
                <Stat tone="red" icon="bi-x-octagon" label="Cancelled Orders" value={cancelled.length} hint="Cancelled order count" trend="down" />
                <Stat tone="yellow" icon="bi-cash-stack" label="Cancelled Quantity" value={cancelledQty} hint="Units from cancelled orders" trend="down" />
            </SummaryRow>

            <div className="filter-pills">
                {PILLS.map((name) => {
                    const count = name === 'All' ? state.orders.length : state.orders.filter((order) => order.status === name).length;
                    return (
                        <OrderFilterButton
                            key={name}
                            active={pill === name}
                            label={name}
                            count={count}
                            onClick={() => setPill(name)}
                        />
                    );
                })}
            </div>

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input type="text" placeholder="Search orders by customer, product, or ID..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Customer Orders</h2>
                        <p>{filtered.length} order{filtered.length === 1 ? '' : 's'}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Order ID</th><th>Customer</th><th>Product</th><th>Quantity</th>
                                <th>Total</th><th>Date</th><th>Status</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <EmptyState icon="bi-cart-check" title="No orders found" body="Orders placed by your customers will show up here." />
                                    </td>
                                </tr>
                            ) : filtered.map((order) => (
                                <tr key={order.id} className="clickable-row" onClick={() => viewOrder(order)}>
                                    <td><b>#{order.id}</b></td>
                                    <td>{order.customer}</td>
                                    <td>{order.product}</td>
                                    <td>{order.quantity}</td>
                                    <td className="strong-cell">{money(order.total)}</td>
                                    <td>{order.date}</td>
                                    <td><StatusBadge value={order.status} /></td>
                                    <td>
                                        <ViewOrderButton onClick={(event) => { event.stopPropagation(); viewOrder(order); }} />
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
