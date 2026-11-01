import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { dayLabel, isoDate, stockAtDate, toISODate, useStore } from '../store.js';
import { totalStock } from '../products.js';
import { useSession } from '../auth.js';
import { EmptyState, StatusBadge } from './ui.jsx';
import Button from '../buttons/Button.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CHART = { width: 700, height: 250, padLeft: 48, padRight: 20, padTop: 26, padBottom: 48 };

/** The Monday of the week `date` falls in, as YYYY-MM-DD. */
function mondayOf(date = new Date()) {
    const day = new Date(date);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return isoDate(day);
}

function shiftDays(iso, days) {
    const date = new Date(`${iso}T00:00:00`);
    date.setDate(date.getDate() + days);
    return isoDate(date);
}

/** "Oct 5 – Oct 11, 2026", or "Sep 28 – Oct 4, 2026" across a month edge. */
function weekRangeLabel(startIso) {
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(`${shiftDays(startIso, 6)}T00:00:00`);
    const month = (date) => date.toLocaleDateString('en-PH', { month: 'short' });
    return `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

function shortDate(iso) {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

/** "10:32 AM" out of a HH:MM 24-hour stamp. */
function to12Hour(value) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return '';
    const hours = Number(match[1]);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;
    return `${String(hour).padStart(2, '0')}:${match[2]} ${period}`;
}

/** "10:32" out of a stored "10:32 AM", for sorting. */
function to24Hour(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '00:00';
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

/**
 * Monday–Sunday line chart of total stock on hand. Days that have not
 * happened yet draw no point, so the current week never fakes a future value.
 */
function WeeklyChart({ series, rangeLabel }) {
    const [hover, setHover] = useState(null);

    const recorded = series.filter((day) => day.hasRecord);
    const values = recorded.map((day) => day.value);
    const max = values.length ? Math.max(...values) : 0;
    const min = values.length ? Math.min(...values) : 0;
    const pad = Math.max(Math.ceil((max - min) * 0.35), 5);
    const domainMin = Math.max(0, min - pad);
    const domainMax = max + pad || 1;

    const innerWidth = CHART.width - CHART.padLeft - CHART.padRight;
    const innerHeight = CHART.height - CHART.padTop - CHART.padBottom;
    const step = innerWidth / (series.length - 1);

    const yFor = (value) => CHART.padTop + (1 - (value - domainMin) / (domainMax - domainMin)) * innerHeight;

    const points = series.map((day, index) => ({
        ...day,
        x: CHART.padLeft + index * step,
        y: day.hasRecord ? yFor(day.value) : null,
    }));
    const drawn = points.filter((point) => point.y !== null);

    const line = drawn.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const baseY = CHART.padTop + innerHeight;
    const area = drawn.length
        ? `${line} L${drawn[drawn.length - 1].x.toFixed(1)} ${baseY} L${drawn[0].x.toFixed(1)} ${baseY} Z`
        : '';

    const gridLines = Array.from({ length: 6 }, (_, index) => {
        const fraction = index / 5;
        const value = domainMax - (domainMax - domainMin) * fraction;
        return { y: CHART.padTop + fraction * innerHeight, label: Math.round(value) };
    });

    const active = hover !== null ? points[hover] : null;

    if (!drawn.length) {
        return <div className="wso-chart-empty">No stock records to chart for this week yet.</div>;
    }

    return (
        <div className="wso-chart-pad">
            <div className="wso-chart-wrap">
                <svg className="stock-chart wso-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="Weekly stock overview">
                    <defs>
                        <linearGradient id="wsoGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="#22c55e" stopOpacity="0.22" />
                            <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {gridLines.map((row) => (
                        <g key={row.y}>
                            <line x1={CHART.padLeft} y1={row.y} x2={CHART.width - CHART.padRight} y2={row.y} stroke="currentColor" strokeOpacity="0.16" />
                            <text x={CHART.padLeft - 8} y={row.y + 4} textAnchor="end">{row.label}</text>
                        </g>
                    ))}

                    <path d={area} fill="url(#wsoGradient)" />
                    <path d={line} fill="none" stroke="#22a750" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {drawn.map((point) => (
                        <text
                            key={`value-${point.iso}`}
                            x={point.x}
                            y={point.y - 12}
                            textAnchor="middle"
                            className="wso-point-value"
                        >
                            {point.value}
                        </text>
                    ))}

                    {points.map((point, index) => (point.y === null ? null : (
                        <g
                            key={`dot-${point.iso}`}
                            onMouseEnter={() => setHover(index)}
                            onMouseLeave={() => setHover(null)}
                            className="wso-point"
                        >
                            <circle cx={point.x} cy={point.y} r="16" fill="transparent" />
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r={hover === index ? 6 : 4.5}
                                fill="#ffffff"
                                stroke="#22a750"
                                strokeWidth="3"
                            />
                        </g>
                    )))}

                    {points.map((point, index) => (
                        <g key={`tick-${point.iso}`} className={point.hasRecord ? '' : 'is-future'}>
                            <text x={point.x} y={CHART.height - 26} textAnchor="middle">{shortDate(point.iso)}</text>
                            <text x={point.x} y={CHART.height - 8} textAnchor="middle" className="wso-weekday">({WEEKDAYS[index]})</text>
                        </g>
                    ))}
                </svg>

                {active ? (
                    <div className="wso-tooltip" style={{ left: `${(active.x / CHART.width) * 100}%`, top: `${(active.y / CHART.height) * 100}%` }}>
                        <b>{active.value.toLocaleString('en-PH')} units on hand</b>
                        <small>
                            {WEEKDAY_NAMES[series.findIndex((day) => day.iso === active.iso)]}, {shortDate(active.iso)}
                            {active.net ? ` · ${active.net > 0 ? '+' : ''}${active.net} moved` : ''}
                        </small>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function WsoChip({ icon, label, value, hint, tone = '', className = '' }) {
    return (
        <div className="wso-chip">
            <span className={`wso-chip-icon ${tone}`.trim()}><i className={`bi ${icon}`}></i></span>
            <div className="wso-chip-body">
                <span className="wso-chip-label">{label}</span>
                <strong className={className}>{value}</strong>
                <small>{hint}</small>
            </div>
        </div>
    );
}

const DONUT_COLORS = ['#1f9d55', '#f59e0b', '#34c77b', '#0f7a3d', '#79d9a1', '#e0a80f', '#2fb35f', '#28633a'];

const DONUT = { cx: 255, cy: 180, r: 108, stroke: 40, labelR: 143 };

/** Soft light halo drawn behind the ring. */
const HALO = 160;

/** Length of the slow light sweep that travels around the ring. */
const SWEEP = 54;

/**
 * Units held in each category on `weekEnd`, biggest first. Categories with no
 * stock on that date are dropped, so the donut only shows what existed then.
 */
export function categorySeriesFor(products, moves, weekEnd) {
    const totals = new Map();
    products.forEach((product) => {
        const name = product.category || 'Uncategorised';
        const units = stockAtDate(product, weekEnd, moves);
        if (units > 0) totals.set(name, (totals.get(name) || 0) + units);
    });
    return [...totals.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, units]) => ({ name, units }));
}

/** Donut of the units held in each category, labelled like the design. */
function CategoryDonut({ series, dateLabel }) {
    const [mounted, setMounted] = useState(false);
    const [grown, setGrown] = useState(false);
    const [settled, setSettled] = useState(false);
    const [hover, setHover] = useState(null);

    // Paint the zero-length ring first, then flip to the real arcs so the CSS
    // growth transition has a starting value to animate from.
    useEffect(() => {
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setMounted(true));
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, []);

    // Replays the entrance whenever the selected week changes the data.
    useEffect(() => {
        setGrown(false);
        setSettled(false);
        setHover(null);
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => setGrown(true));
        });
        const timer = setTimeout(() => setSettled(true), 1700);
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
            clearTimeout(timer);
        };
    }, [series]);

    const slices = useMemo(() => {
        const sorted = [...series].sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));
        const head = sorted.slice(0, 7).map((row) => ({ ...row }));
        const rest = sorted.slice(7);
        if (rest.length) {
            const extra = rest.reduce((sum, row) => sum + row.units, 0);
            const merged = head.find((row) => row.name === 'Other');
            if (merged) merged.units += extra;
            else head.push({ name: 'Other', units: extra });
        }
        return head;
    }, [series]);

    const total = slices.reduce((sum, slice) => sum + slice.units, 0);
    if (!total) {
        return (
            <EmptyState
                icon="bi-grid"
                title="No stock that week"
                body={`Nothing was on hand at the end of the week of ${dateLabel}.`}
            />
        );
    }

    const circumference = 2 * Math.PI * DONUT.r;
    let cursor = 0;
    const rows = slices.map((slice, index) => {
        const arc = (slice.units / total) * circumference;
        const mid = -Math.PI / 2 + ((cursor + arc / 2) / circumference) * 2 * Math.PI;
        const cos = Math.cos(mid);
        const full = `${slice.name}: ${slice.units}`;
        const twoLine = full.length > 10;
        const row = {
            ...slice,
            line1: twoLine
                ? (slice.name.length > 11 ? `${slice.name.slice(0, 10)}…` : slice.name)
                : full,
            line2: twoLine ? String(slice.units) : null,
            color: DONUT_COLORS[index % DONUT_COLORS.length],
            dash: Math.max(arc - 3, 1),
            offset: cursor,
            percent: Math.round((slice.units / total) * 100),
            lx: DONUT.cx + DONUT.labelR * cos,
            ly: DONUT.cy + DONUT.labelR * Math.sin(mid),
            up: Math.sin(mid) < 0,
            anchor: cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle',
        };
        cursor += arc;
        return row;
    });

    const active = hover !== null ? rows[hover] : null;

    return (
        <div className="wso-cat-wrap">
            <svg className={`wso-cat-svg${active ? ' has-hover' : ''}`} viewBox="0 0 510 360" role="img" aria-label={`Stock on hand by category, week of ${dateLabel}`}>
                <defs>
                    <radialGradient id="wso-halo">
                        <stop offset="62%" stopColor="#3ee08c" stopOpacity="0" />
                        <stop offset="80%" stopColor="#3ee08c" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3ee08c" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <circle cx={DONUT.cx} cy={DONUT.cy} r={HALO} fill="url(#wso-halo)" />

                <g className="wso-cat-ring" transform={`rotate(-90 ${DONUT.cx} ${DONUT.cy})`}>
                    {rows.map((row, index) => (
                        <circle
                            key={row.name}
                            className={`wso-cat-slice${hover === index ? ' is-hover' : ''}`}
                            style={{ '--delay': settled ? '0ms' : `${index * 90}ms` }}
                            cx={DONUT.cx}
                            cy={DONUT.cy}
                            r={DONUT.r}
                            fill="none"
                            stroke={row.color}
                            strokeWidth={DONUT.stroke}
                            strokeDasharray={grown ? `${row.dash} ${circumference - row.dash}` : `0 ${circumference}`}
                            strokeDashoffset={-row.offset}
                            onMouseEnter={() => setHover(index)}
                            onMouseLeave={() => setHover(null)}
                        >
                            <title>{`${row.name}: ${row.units} unit${row.units === 1 ? '' : 's'} on hand (${row.percent}%)`}</title>
                        </circle>
                    ))}
                </g>

                <g className="wso-cat-sweep-wrap">
                    <circle
                        cx={DONUT.cx}
                        cy={DONUT.cy}
                        r={DONUT.r}
                        fill="none"
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth={DONUT.stroke - 6}
                        strokeDasharray={`${SWEEP} ${circumference - SWEEP}`}
                    />
                </g>

                {rows.map((row, index) => (
                    <text
                        key={`label-${row.name}`}
                        className="wso-cat-label"
                        x={row.lx}
                        y={row.line2
                            ? (row.up ? row.ly - 21 : row.ly + 11)
                            : (row.up ? row.ly - 4 : row.ly + 11)}
                        textAnchor={row.anchor}
                        fill={row.color}
                        style={{
                            opacity: mounted ? 1 : 0,
                            transition: `opacity 520ms ease ${settled ? 0 : 540 + index * 90}ms`,
                        }}
                    >
                        {row.line1}
                        {row.line2 ? <tspan x={row.lx} dy="17">{row.line2}</tspan> : null}
                    </text>
                ))}
            </svg>

            {active ? (
                <div className="wso-cat-tip">
                    <b>{active.name}</b>
                    <small>
                        {active.units} unit{active.units === 1 ? '' : 's'} · {active.percent}%
                    </small>
                </div>
            ) : null}
        </div>
    );
}

/**
 * The shared weekly stock panel plus its Recent Activity table: one week of
 * stock on hand, the movement that changed it and the activity behind it.
 * Both dashboards render this exact component, so admin and staff always read
 * the same numbers from the same records.
 */
export default function WeeklyStockOverview({ title = 'Stock Overview' }) {
    const state = useStore();
    const session = useSession();
    const role = session?.role || 'admin';

    const [weekStart, setWeekStart] = useState(() => mondayOf());

    const today = isoDate();
    const thisWeek = mondayOf();
    const atCurrentWeek = weekStart >= thisWeek;
    const weekEnd = shiftDays(weekStart, 6);
    const rangeLabel = weekRangeLabel(weekStart);

    const series = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, index) => shiftDays(weekStart, index));
        return days.map((day, index) => {
            const value = state.products.reduce(
                (sum, product) => sum + stockAtDate(product, day, state.stockMoves),
                0,
            );
            const net = state.stockMoves.reduce((sum, move) => {
                const moved = toISODate(move.date);
                if (moved !== day) return sum;
                return sum + (move.action === 'Stock In' ? Number(move.quantity) : -Number(move.quantity));
            }, 0);
            return {
                iso: day,
                weekday: WEEKDAYS[index],
                value,
                net,
                hasRecord: day <= today,
            };
        });
    }, [state, weekStart, today]);

    const recorded = series.filter((day) => day.hasRecord);
    const onHand = state.products.reduce((sum, product) => sum + totalStock(product), 0);
    const highest = recorded.length ? Math.max(...recorded.map((day) => day.value)) : 0;
    const lowest = recorded.length ? Math.min(...recorded.map((day) => day.value)) : 0;

    const weekMoves = state.stockMoves.filter((move) => {
        const moved = toISODate(move.date);
        return Boolean(moved) && moved >= weekStart && moved <= weekEnd;
    });

    const netMovement = weekMoves.reduce(
        (sum, move) => sum + (move.action === 'Stock In' ? Number(move.quantity) : -Number(move.quantity)),
        0,
    );

    const activity = useMemo(() => {
        const inWeek = (value) => {
            const iso = toISODate(value);
            return Boolean(iso) && iso >= weekStart && iso <= weekEnd;
        };

        const movements = state.stockMoves.filter((move) => inWeek(move.date)).map((move) => ({
            key: `move-${move.id}`,
            day: toISODate(move.date),
            clock: to24Hour(move.time),
            time: move.time || dayLabel(toISODate(move.date)),
            activity: move.action,
            product: move.product,
            staff: move.user,
        }));

        const sales = state.sales.filter((sale) => inWeek(sale.date) || inWeek(sale.created_at)).map((sale) => ({
            key: `sale-${sale.id}`,
            day: toISODate(sale.date) || toISODate(sale.created_at),
            clock: String(sale.created_at || '').slice(11, 16) || '00:00',
            time: to12Hour(sale.created_at) || dayLabel(toISODate(sale.date)),
            activity: 'Sale',
            product: (sale.items || []).map((item) => item.product).join(', '),
            staff: sale.cashier,
        }));

        return [...movements, ...sales]
            .sort((a, b) => (a.day === b.day ? (a.clock < b.clock ? 1 : -1) : (a.day < b.day ? 1 : -1)))
            .slice(0, 8);
    }, [state.stockMoves, state.sales, weekStart, weekEnd]);

    // Units held in each category on the last day of the selected week, so the
    // donut changes as the week controls move.
    const categorySeries = useMemo(
        () => categorySeriesFor(state.products, state.stockMoves, weekEnd),
        [state.products, state.stockMoves, weekEnd],
    );

    return (
        <>
            <div className="wso-grid">
                <section className="admin-panel wso">
                    <div className="panel-heading">
                        <div>
                            <h2>{title}</h2>
                            <p>Weekly stock movement ({rangeLabel})</p>
                        </div>
                        <div className="panel-heading-tools wso-week">
                            <Button
                                variant="soft"
                                title="Previous week"
                                onClick={() => setWeekStart((start) => shiftDays(start, -7))}
                            >
                                <i className="bi bi-chevron-left"></i> Previous Week
                            </Button>
                            <span className="wso-range">
                                <i className="bi bi-calendar3"></i> {rangeLabel} <i className="bi bi-chevron-down"></i>
                            </span>
                            <Button
                                variant="soft"
                                title="Next week"
                                disabled={atCurrentWeek}
                                onClick={() => setWeekStart((start) => shiftDays(start, 7))}
                            >
                                Next Week <i className="bi bi-chevron-right"></i>
                            </Button>
                            <Button
                                variant={`soft${atCurrentWeek ? ' is-on' : ''}`}
                                title="Back to the current week"
                                disabled={atCurrentWeek}
                                onClick={() => setWeekStart(mondayOf())}
                            >
                                <i className="bi bi-calendar-check"></i> Current Week
                            </Button>
                        </div>
                    </div>

                    <div className="wso-chips">
                        <WsoChip icon="bi-box-seam" label="On hand" value={onHand.toLocaleString('en-PH')} hint="Total stock units" />
                        <WsoChip
                            icon="bi-arrow-left-right"
                            label="Net movement"
                            value={`${netMovement > 0 ? '+' : ''}${netMovement}`}
                            hint="Stock in minus stock out"
                            className={netMovement > 0 ? 'is-up' : netMovement < 0 ? 'is-down' : 'is-flat'}
                        />
                        <WsoChip icon="bi-graph-up-arrow" label="Highest" value={highest.toLocaleString('en-PH')} hint="Highest stock quantity" />
                        <WsoChip icon="bi-graph-down-arrow" label="Lowest" value={lowest.toLocaleString('en-PH')} hint="Lowest stock quantity" />
                    </div>

                    <div className="chart-legend wso-legend">
                        <span><i></i> Stock Units</span>
                        <small>Stock levels per day ({rangeLabel})</small>
                    </div>

                    <WeeklyChart series={series} rangeLabel={rangeLabel} />
                </section>

                <section className="admin-panel wso-category-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Products by Category</h2>
                            <p>Units on hand by category · as of {shortDate(weekEnd)}</p>
                        </div>
                    </div>
                    <div className="wso-category-body">
                        <CategoryDonut series={categorySeries} dateLabel={shortDate(weekEnd)} />
                    </div>
                </section>
            </div>

            <section className="admin-panel wso-activity-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Recent Activity</h2>
                    </div>
                    <Link className="wso-view-all" to={`/${role}/history`}>View all <i className="bi bi-arrow-right"></i></Link>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Time</th><th>Activity</th><th>Product</th><th>Staff</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {activity.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <EmptyState
                                            icon="bi-arrow-left-right"
                                            title="No activity this week"
                                            body="Stock in, stock out and completed sales recorded this week will appear here."
                                        />
                                    </td>
                                </tr>
                            ) : activity.map((row) => (
                                <tr key={row.key}>
                                    <td>{row.time}</td>
                                    <td>{row.activity}</td>
                                    <td>{row.product}</td>
                                    <td>{row.staff}</td>
                                    <td><StatusBadge value="Completed" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
