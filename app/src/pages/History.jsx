import { useState } from 'react';
import { useStore } from '../store.js';
import { EmptyState, MovementPill, PageHead } from '../components/ui.jsx';

const ACTIONS = ['All', 'Stock In', 'Stock Out', 'Adjustment', 'Damaged', 'Expired'];

export default function History() {
    const state = useStore();
    const [query, setQuery] = useState('');
    const [action, setAction] = useState('All');

    const filtered = state.stockMoves.filter((move) => {
        const matchesAction = action === 'All' || move.action === action;
        const keyword = query.trim().toLowerCase();
        const matchesQuery = !keyword
            || [move.product, move.reference, move.user, move.remarks, move.unit, move.reason].some((field) => String(field || '').toLowerCase().includes(keyword));
        return matchesAction && matchesQuery;
    });

    return (
        <>
            <PageHead
                title="Inventory History"
                subtitle="Track every inventory movement and maintain a clear audit trail."
            />

            <div className="admin-toolbar">
                <label className="admin-search">
                    <i className="bi bi-search"></i>
                    <input
                        type="text"
                        placeholder="Search history by product, reference, or user..."
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                <select className="admin-select" value={action} onChange={(event) => setAction(event.target.value)}>
                    {ACTIONS.map((name) => <option key={name} value={name}>{name === 'All' ? 'All Actions' : name}</option>)}
                </select>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Inventory Activity</h2>
                        <p>A chronological record of stock intakes and deductions</p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th><th>Time</th><th>Product</th><th>Action</th><th>Quantity</th><th>Unit</th><th>Reason</th>
                                <th>Previous Stock</th><th>New Stock</th><th>User</th><th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="11">
                                        <EmptyState icon="bi-clock-history" title="No movements yet" body="Stock in and stock out entries will appear here." />
                                    </td>
                                </tr>
                            ) : filtered.map((move) => (
                                <tr key={move.id}>
                                    <td>{move.date}</td>
                                    <td>{move.time || '—'}</td>
                                    <td><b>{move.product}</b></td>
                                    <td><MovementPill action={move.action} /></td>
                                    <td className={move.action === 'Stock In' ? 'positive-cell' : ''}>{move.quantity}</td>
                                    <td>{move.unit || 'Units'}</td>
                                    <td>{move.remarks || '—'}</td>
                                    <td>{move.previous}</td>
                                    <td className="strong-cell">{move.next}</td>
                                    <td>{move.user}</td>
                                    <td>{move.reference}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
