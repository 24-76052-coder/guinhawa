import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money, todayLabel, useStore } from '../store.js';
import { useSession } from '../auth.js';
import { EmptyState, PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import OpenReceiptButton from '../buttons/cashier/OpenReceiptButton.jsx';

export default function Receipts() {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();
    const role = session?.role || 'admin';
    const [query, setQuery] = useState('');

    const today = todayLabel();
    const sales = [...state.sales].reverse();
    const todaySales = sales.filter((sale) => sale.date === today);

    const filtered = sales.filter((sale) => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return true;
        const products = sale.items.map((item) => item.product).join(' ');
        return [sale.receipt_no, sale.customer, sale.payment_method, products]
            .some((field) => String(field || '').toLowerCase().includes(keyword));
    });

    const sum = (list) => list.reduce((total, sale) => total + Number(sale.total || 0), 0);

    return (
        <>
            <PageHead
                title="Receipts & Sales"
                subtitle="Every checkout taken at the counter, with its payment and receipt."
                actions={<Link className="admin-primary" to={`/${role}/sales`}><i className="bi bi-upc-scan"></i> New Sale</Link>}
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-cash-coin" label="Sales Today" value={money(sum(todaySales))} />
                <Stat tone="blue" icon="bi-receipt" label="Receipts Today" value={todaySales.length} />
                <Stat tone="yellow" icon="bi-stack" label="Total Sales" value={money(sum(sales))} />
                <Stat tone="purple" icon="bi-list-check" label="Total Receipts" value={sales.length} />
            </SummaryRow>

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input type="text" placeholder="Search receipts by number, customer, product..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Sales Transactions</h2>
                        <p>{filtered.length} sale{filtered.length === 1 ? '' : 's'}</p>
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
                                        <EmptyState icon="bi-receipt" title="No receipts yet" body="Complete a sale to issue your first receipt." />
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
