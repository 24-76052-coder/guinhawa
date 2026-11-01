import { useEffect, useState } from 'react';
import { clockParts } from '../store.js';
import logoSrc from '../assets/logo.png';

/** The same round emblem used on the sign-in screen. */
export function Logo({ href = '/' }) {
    return (
        <a className="admin-logo" href={href}>
            <img className="admin-logo-img" src={logoSrc} alt="Guinhawa Poultry Supply" />
            <span>
                <b>GUINHAWA</b>
                <small>POULTRY SUPPLY</small>
            </span>
        </a>
    );
}

/** Live date + clock used by the topbar. */
export function TopbarClock() {
    const [now, setNow] = useState(() => clockParts());

    useEffect(() => {
        const timer = setInterval(() => setNow(clockParts()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="today-when" title="Current date and time">
            <span className="today-date">
                <i className="bi bi-calendar3"></i> <span>{now.date}</span>
            </span>
            <span className="topbar-clock">
                <i className="bi bi-clock"></i> <b>{now.time}</b> <small>{now.period}</small>
            </span>
        </div>
    );
}

/** Section heading + intro copy above a table. */
export function PageHead({ title, subtitle, actions, kicker = 'GUINHAWA POULTRY SUPPLY' }) {
    return (
        <div className="admin-page-head">
            <div>
                {kicker ? <span className="admin-kicker">{kicker}</span> : null}
                <h1>{title}</h1>
                {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions}
        </div>
    );
}

/** One dashboard statistic card (same markup as the old summary rows). */
export function Stat({ tone = 'green', icon, label, value, hint, trend = 'up' }) {
    return (
        <article className="summary-card">
            <span className={`summary-icon ${tone}`}><i className={`bi ${icon}`}></i></span>
            <div>
                <span>{label}</span>
                <strong>{value}</strong>
                {hint ? <small>{hint}</small> : null}
            </div>
            <span className="summary-trend">
                <i className={`bi bi-arrow-${trend === 'down' ? 'down' : 'up'}-right`}></i>
            </span>
        </article>
    );
}

export function SummaryRow({ children, className = '' }) {
    return <div className={`summary-row ${className}`.trim()}>{children}</div>;
}

export function StatusBadge({ value }) {
    const slug = String(value || '').toLowerCase().replace(/[\s_]+/g, '-');
    return (
        <span className={`status-badge ${slug}`}>
            <i></i>
            {value}
        </span>
    );
}

/** Empty / no-results placeholder that matches the rest of the panel. */
export function EmptyState({ icon = 'bi-inbox', title, body, action }) {
    return (
        <div className="empty-state">
            <span><i className={`bi ${icon}`}></i></span>
            <h3>{title}</h3>
            {body ? <p>{body}</p> : null}
            {action}
        </div>
    );
}

/** Pill used by the inventory history action column. */
export function MovementPill({ action }) {
    const slug = String(action).toLowerCase().replace(/[\s_]+/g, '-');
    return <span className={`movement-pill ${slug}`}>{action}</span>;
}

/** Simple previous / next pager used by the catalogue and inventory tables. */
export function Pagination({ page, pageCount, onPage, total, pageSize = 20 }) {
    if (!pageCount || pageCount <= 1) return null;
    const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, total);
    return (
        <div className="table-pager">
            <span>{first}–{last} of {total}</span>
            <div className="table-pager-buttons">
                <button type="button" className="admin-soft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                    <i className="bi bi-chevron-left"></i> Previous
                </button>
                <b>Page {page} of {pageCount}</b>
                <button type="button" className="admin-soft" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
                    Next <i className="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    );
}
