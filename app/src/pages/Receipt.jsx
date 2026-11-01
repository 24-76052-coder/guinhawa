import { Link, Navigate, useParams } from 'react-router-dom';
import { money, useStore } from '../store.js';
import { unitShort } from '../products.js';
import { useSession, useStaffRoster } from '../auth.js';
import { LOGIN_URL, canAccess, roleByKey } from '../roles.js';
import { Denied } from '../components/Guarded.jsx';
import PrintReceiptButton from '../buttons/cashier/PrintReceiptButton.jsx';
import logoSrc from '../assets/logo.png';

/** Standalone printable receipt - deliberately outside the panel chrome. */
export default function Receipt() {
    const { role, id } = useParams();
    const state = useStore();
    const session = useSession();
    const staffRoster = useStaffRoster();

    if (!roleByKey(role)) {
        return <Denied status={404} title="Page not found" message="There is no workspace at this address." />;
    }

    if (!session) {
        return <Denied status={401} title="Please sign in" message="Sign in to open this receipt." />;
    }

    // A session without a workspace cannot open a receipt.
    if (!session.role) {
        return <Navigate to={LOGIN_URL} replace />;
    }

    const canonicalRole = roleByKey(role).key;
    if (session.role !== canonicalRole || !canAccess(canonicalRole, '/receipt')) {
        return <Denied status={403} title="Access denied" message="Sign in with an account that can open receipts." />;
    }

    const sale = state.sales.find((item) => String(item.id) === String(id));
    if (!sale) {
        return <Denied status={404} title="Page not found" message="That receipt does not exist any more." />;
    }

    const settings = state.settings;
    const isCounter = canonicalRole === 'counter-staff';
    const backToList = isCounter ? `/${canonicalRole}/sales-history` : `/${canonicalRole}/receipts`;
    const legacyNames = {
        'STF-1042': 'Sofia Reyes',
        'STF-1043': 'Daniel Cruz',
        'CST-001': 'Sofia Reyes',
        'INV-001': 'Daniel Cruz',
        'ADMIN-01': 'JUSWAA',
    };
    const staffCode = sale.staff_id || (/^(?:[A-Z]+)-\d+$/i.test(String(sale.cashier || '')) ? sale.cashier : '');
    const cashierLooksLikeCode = /^(?:[A-Z]+)-\d+$/i.test(String(sale.cashier || ''));
    const rosterMatch = staffRoster.find((staff) => staff.code === staffCode);
    const processedBy = !cashierLooksLikeCode && sale.cashier
        ? sale.cashier
        : legacyNames[staffCode] || rosterMatch?.name || 'Staff account';

    return (
        <main className="receipt-screen">
            <div className="receipt-actions no-print">
                <Link className="receipt-back-button" to={backToList}><i className="bi bi-arrow-left"></i> Back</Link>
                <PrintReceiptButton onClick={() => window.print()} />
            </div>

            <article className="receipt-sheet">
                <header className="receipt-head">
                    <img className="receipt-logo" src={logoSrc} alt="Guinhawa Poultry Supply" />
                    <h1>{settings.store_name}</h1>
                    <p>{settings.address}</p>
                    <p>{settings.phone}</p>
                </header>

                <div className="receipt-meta">
                    <div><span>Receipt</span><b>{sale.receipt_no}</b></div>
                    <div><span>Date</span><b>{sale.date}</b></div>
                    <div><span>Customer</span><b>{sale.customer}</b></div>
                    <div><span>Payment</span><b>{sale.payment_method}</b></div>
                    <div><span>Status</span><b>{sale.status}</b></div>
                    <div className="receipt-processor"><span>Processed by</span><b>{processedBy}</b><small>{staffCode || 'ADMIN-01'}</small></div>
                </div>

                <table className="receipt-lines">
                    <thead>
                        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                        {sale.items.map((item, index) => (
                            <tr key={`${item.product_id}-${item.variant || 'A'}-${index}`}>
                                <td>
                                    {item.product}
                                    {item.unit ? <small className="cell-sub">{item.unit}</small> : null}
                                </td>
                                <td>{item.quantity}{item.unit ? ` ${unitShort(item.unit)}` : ''}</td>
                                <td>{money(item.price)}{item.unit ? <small className="cell-sub"> / {unitShort(item.unit)}</small> : null}</td>
                                <td>{money(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="receipt-totals">
                    <div><span>Subtotal</span><b>{money(sale.subtotal)}</b></div>
                    <div><span>Discount</span><b>{money(sale.discount)}</b></div>
                    <div className="receipt-total-due"><span>Total Due</span><b>{money(sale.total)}</b></div>
                    <div><span>Amount Tendered</span><b>{money(sale.amount_tendered)}</b></div>
                    <div><span>Change</span><b>{money(sale.change_due)}</b></div>
                </div>

                <footer className="receipt-foot">
                    <p>Thank you for shopping with us!</p>
                    <small>Quality supplies. Healthy poultry. Happy farmers.</small>
                </footer>
            </article>
        </main>
    );
}
