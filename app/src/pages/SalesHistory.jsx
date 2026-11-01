import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isoDate, money, toISODate, useStore } from '../store.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import OpenReceiptButton from '../buttons/cashier/OpenReceiptButton.jsx';

/** Every receipt the counter has issued - the cashier's copy of Sales. */
export default function SalesHistory() {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const role = session?.role || 'counter-staff';
    const isAdmin = role === 'admin';
    const today = isoDate();
    const sales = [...state.sales]
        .filter((sale) => isAdmin || sale.staff_id === session?.username || sale.cashier === session?.username)
        .reverse();
    const isToday = (sale) => toISODate(sale.date) === today || toISODate(sale.created_at) === today;
    const todaySales = sales.filter(isToday);

    const filtered = sales.filter((sale) => {
        const keyword = query.trim().toLowerCase();
        const products = sale.items.map((item) => item.product).join(' ');
        const matchesKeyword = !keyword || [sale.receipt_no, sale.customer, sale.payment_method, sale.cashier, sale.staff_id, products]
            .some((field) => String(field || '').toLowerCase().includes(keyword));
        const saleDate = toISODate(sale.date) || toISODate(sale.created_at);
        const matchesFrom = !fromDate || (saleDate && saleDate >= fromDate);
        const matchesTo = !toDate || (saleDate && saleDate <= toDate);
        return matchesKeyword && matchesFrom && matchesTo;
    });

    const sum = (list) => list.reduce((total, sale) => total + Number(sale.total || 0), 0);
    const units = (list) => list.reduce((total, sale) => total + sale.items.reduce((line, item) => line + Number(item.quantity || 0), 0), 0);

    return (
        <>
            <PageHead
                title="Sales History"
                subtitle={isAdmin
                    ? 'Every receipt from the store, with the payment, cashier and stock it moved.'
                    : 'Every receipt you have issued, with the payment, cashier and stock it moved.'}
                actions={<Link className="admin-primary" to={`/${role}/pos`}><i className="bi bi-upc-scan"></i> New Sale</Link>}
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-cash-coin" label="Sales Today" value={money(sum(todaySales))} hint={`${todaySales.length} receipt${todaySales.length === 1 ? '' : 's'}`} />
                <Stat tone="blue" icon="bi-bag-check" label="Units Today" value={units(todaySales)} hint="Items handed over" />
                <Stat tone="yellow" icon="bi-receipt" label="Total Receipts" value={sales.length} hint="Since the store opened" />
                <Stat tone="purple" icon="bi-stack" label="Total Sales" value={money(sum(sales))} hint="All recorded sales" />
            </SummaryRow>

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input
                        type="text"
                        placeholder="Search by receipt number, customer, product..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <input className="admin-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" />
                <input className="admin-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="To date" />
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Receipts</h2>
                        <p>{filtered.length} sale{filtered.length === 1 ? '' : 's'}{query ? ' matching your search' : ''}</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Receipt No.</th><th>Date</th><th>Customer</th><th>Items</th>
                                <th>Total</th><th>Payment</th><th>Processed by</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="8">
                                        <EmptyState icon="bi-receipt" title="No receipts yet" body="Complete a sale at the POS and it shows up here straight away." />
                                    </td>
                                </tr>
                            ) : filtered.map((sale) => (
                                <tr key={sale.id} className="clickable-row" onClick={() => navigate(`/${role}/receipt/${sale.id}`)}>
                                    <td><b>{sale.receipt_no}</b></td>
                                    <td>{sale.date}</td>
                                    <td>{sale.customer}</td>
                                    <td>{sale.items.length}</td>
                                    <td className="strong-cell">{money(sale.total)}</td>
                                    <td>{sale.payment_method}</td>
                                    <td>{sale.cashier}</td>
                                    <td>
                                        <div className="table-actions">
                                            <OpenReceiptButton onClick={(event) => { event.stopPropagation(); navigate(`/${role}/receipt/${sale.id}`); }} />
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
