import { useEffect, useMemo, useState } from 'react';
import { getAccountAuditLogs } from '../auth.js';
import { useStore } from '../store.js';
import { EmptyState, PageHead } from '../components/ui.jsx';

/**
 * Two sources feed this page:
 *
 *  - account actions (created / updated / deactivated / password reset) are
 *    written by the API to MySQL so they survive a browser reset;
 *  - product, stock, sale and order actions still live in the local store.
 *
 * Both are shown in one table so the administrator has a single history.
 */
export default function AuditLogs() {
    const state = useStore();
    const [query, setQuery] = useState('');
    const [accountLogs, setAccountLogs] = useState([]);
    const [accountError, setAccountError] = useState('');

    useEffect(() => {
        let alive = true;
        getAccountAuditLogs()
            .then((logs) => {
                if (!alive) return;
                setAccountLogs(logs);
                setAccountError('');
            })
            .catch((error) => {
                if (!alive) return;
                setAccountLogs([]);
                setAccountError(error.message || 'Could not load account activity.');
            });
        return () => {
            alive = false;
        };
    }, []);

    const logs = useMemo(
        () => [...accountLogs, ...(state.auditLogs || [])],
        [accountLogs, state.auditLogs],
    );

    const filtered = logs.filter((log) => {
        const keyword = query.trim().toLowerCase();
        return !keyword || [log.action, log.details, log.user, log.date, log.time]
            .some((value) => String(value || '').toLowerCase().includes(keyword));
    });

    return (
        <>
            <PageHead title="Audit Logs" subtitle="Review important system activity, staff actions, and transaction timestamps." />
            <div className="admin-toolbar">
                <label className="admin-search"><i className="bi bi-search"></i><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity, user, or action..." /></label>
            </div>
            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Activity History</h2>
                        <p>
                            {filtered.length} recorded action{filtered.length === 1 ? '' : 's'}
                            {accountLogs.length ? ` · ${accountLogs.length} account action${accountLogs.length === 1 ? '' : 's'}` : ''}
                        </p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                        <tbody>
                            {accountError ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-cloud-slash" title="Account activity unavailable" body={accountError} /></td></tr>
                            ) : null}
                            {filtered.length === 0 ? (
                                <tr><td colSpan="5"><EmptyState icon="bi-shield-check" title="No audit records" body="Important product, stock, sale, order and account actions will appear here." /></td></tr>
                            ) : filtered.map((log) => (
                                <tr key={log.id}><td>{log.date}</td><td>{log.time}</td><td><b>{log.user}</b></td><td>{log.action}</td><td>{log.details}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
