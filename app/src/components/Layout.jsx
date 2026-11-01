import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { signOut, useSession } from '../auth.js';
import { skipIntroAfterLogout } from '../intro.js';
import { LOGIN_URL, canAccess, roleByKey } from '../roles.js';
import { useStore } from '../store.js';
import { stockState, stockSummary, totalStock } from '../products.js';
import { Logo, TopbarClock } from './ui.jsx';
import MarkAllReadButton from '../buttons/admin/MarkAllReadButton.jsx';
import NotificationsButton from '../buttons/admin/NotificationsButton.jsx';
import ProfileLogoutButton from '../buttons/admin/ProfileLogoutButton.jsx';
import ProfileMenuButton from '../buttons/admin/ProfileMenuButton.jsx';
import SidebarCloseButton from '../buttons/admin/SidebarCloseButton.jsx';
import SidebarLogoutButton from '../buttons/admin/SidebarLogoutButton.jsx';
import SidebarScrimButton from '../buttons/admin/SidebarScrimButton.jsx';
import SidebarToggleButton from '../buttons/admin/SidebarToggleButton.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { useTheme } from '../theme.jsx';

const NAV = [
    { path: '/dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/products', icon: 'bi-box-seam', label: 'Products' },
    { path: '/inventory', icon: 'bi-clipboard-data', label: 'Inventory' },
    { path: '/stock-in', icon: 'bi-box-arrow-in-down', label: 'Stock In' },
    { path: '/stock-out', icon: 'bi-box-arrow-up', label: 'Stock Out' },
    { path: '/expiration', icon: 'bi-calendar2-week', label: 'Expiration Monitoring' },
    { path: '/damaged-expired', icon: 'bi-exclamation-diamond', label: 'Damaged / Expired Products' },
    { path: '/suppliers', icon: 'bi-truck', label: 'Suppliers' },
    { path: '/sales-history', icon: 'bi-receipt-cutoff', label: 'Sales History' },
    { path: '/staff', icon: 'bi-person-vcard', label: 'User Management' },
    { path: '/orders', icon: 'bi-cart-check', label: 'Orders', badge: 'pending' },
    { path: '/attendance', icon: 'bi-calendar-check', label: 'Attendance' },
    { path: '/history', icon: 'bi-clock-history', label: 'Inventory History' },
    { path: '/reports', icon: 'bi-file-earmark-bar-graph', label: 'Reports' },
    { path: '/audit-logs', icon: 'bi-shield-check', label: 'Audit Logs' },
    { path: '/settings', icon: 'bi-gear', label: 'Settings' },
];

/** Counter staff can view product availability and record customer sales only. */
const COUNTER_NAV = [
    { path: '/overview', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/pos', icon: 'bi-upc-scan', label: 'POS / Sales' },
    { path: '/available-stocks', icon: 'bi-boxes', label: 'Available Stocks' },
    { path: '/sales-history', icon: 'bi-receipt', label: 'Sales History' },
    { path: '/attendance', icon: 'bi-calendar-check', label: 'Attendance' },
];

const INVENTORY_NAV = [
    { path: '/overview', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/products', icon: 'bi-box-seam', label: 'Products' },
    { path: '/inventory', icon: 'bi-clipboard-data', label: 'Inventory' },
    { path: '/stock-in', icon: 'bi-box-arrow-in-down', label: 'Stock In' },
    { path: '/stock-out', icon: 'bi-box-arrow-up', label: 'Stock Out' },
    { path: '/low-stock', icon: 'bi-exclamation-triangle', label: 'Low Stock' },
    { path: '/expiration', icon: 'bi-calendar2-week', label: 'Expiration Monitoring' },
    { path: '/damaged-expired', icon: 'bi-exclamation-diamond', label: 'Damaged / Expired Products' },
    { path: '/suppliers', icon: 'bi-truck', label: 'Suppliers' },
    { path: '/history', icon: 'bi-clock-history', label: 'Inventory History' },
    { path: '/attendance', icon: 'bi-calendar-check', label: 'Attendance' },
];

function Popover({ children, className, open }) {
    return <div className={`top-popover ${className || ''}`} hidden={!open}>{children}</div>;
}

export default function Layout({ children, title }) {
    const session = useSession();
    const { theme, toggleTheme } = useTheme();
    const role = session?.role || 'admin';
    const roleLabel = roleByKey(role)?.label || role;
    const state = useStore();
    const location = useLocation();
    const navigate = useNavigate();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [readKeys, setReadKeys] = useState([]);
    const closeTimers = useRef({});
    const sidebarRef = useRef(null);
    const sidebarScrollRef = useRef(0);

    useEffect(() => {
        setDrawerOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);

        // Keep the sidebar and page position stable when navigating between
        // dashboard, products, inventory, POS and staff screens.
        const frame = requestAnimationFrame(() => {
            if (sidebarRef.current) {
                sidebarRef.current.scrollTop = sidebarScrollRef.current;
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [location.pathname]);

    useEffect(() => {
        document.title = `${title} | Guinhawa Poultry Supply`;
    }, [title]);

    const pendingOrders = state.orders.filter((order) => order.status === 'Pending' || order.status === 'Confirmed').length;

    /** Live bell feed: what the counter needs to know, straight from the store. */
    const notifications = useMemo(() => {
        const list = [];

        state.products
            .filter((product) => stockState(product) !== 'In Stock'
                && !(product.awaiting_stock && totalStock(product) <= 0))
            .slice(0, 3)
            .forEach((product) => {
                const empty = totalStock(product) <= 0;
                list.push({
                    tone: 'yellow',
                    icon: empty ? 'bi-x-octagon' : 'bi-exclamation-triangle',
                    title: empty ? 'Out of stock' : 'Low stock alert',
                    body: `${product.name} is down to ${stockSummary(product)}.`,
                    time: 'Just now',
                });
            });

        state.orders
            .filter((order) => order.status === 'Pending' || order.status === 'Confirmed')
            .slice(0, 2)
            .forEach((order) => {
                list.push({
                    tone: 'green',
                    icon: 'bi-cart-check',
                    title: 'New customer order',
                    body: `${order.customer} placed order ${order.id}.`,
                    time: order.date,
                });
            });

        if (!list.length) {
            list.push({
                tone: 'blue',
                icon: 'bi-check2-circle',
                title: 'All caught up',
                body: 'Nothing needs your attention right now.',
                time: 'Just now',
            });
        }

        return list;
    }, [state.products, state.orders]);

    const notifKeys = notifications.map((item) => `${item.title}|${item.body}`);
    const unread = notifKeys.filter((key) => !readKeys.includes(key)).length;
    const isCounter = role === 'counter-staff';
    const isInventoryStaff = role === 'inventory-staff';
    const isStaff = isCounter || isInventoryStaff;
    const nav = isCounter ? COUNTER_NAV : isInventoryStaff ? INVENTORY_NAV : NAV;
    const items = nav.filter((item) => canAccess(role, item.path));

    const delayClose = (key, close) => {
        clearTimeout(closeTimers.current[key]);
        closeTimers.current[key] = setTimeout(close, 180);
    };
    const cancelClose = (key) => clearTimeout(closeTimers.current[key]);

    function logout() {
        // The sign-in card is the next thing the user should see, so remember
        // not to replay the opening splash for this visit.
        skipIntroAfterLogout();

        const commit = () => {
            flushSync(() => {
                signOut();
                navigate(LOGIN_URL, { replace: true });
            });
            window.scrollTo(0, 0);
        };

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (typeof document.startViewTransition === 'function' && !reduceMotion) {
            // Cross-fade the workspace into the sign-in screen. The `vt-logout`
            // class turns the card's entrance animations off while the snapshot
            // is captured, then App removes it once the user signs in again.
            document.documentElement.classList.add('vt-logout');
            document.startViewTransition(commit);
        } else {
            commit();
        }
    }

    return (
        <div className={`admin-app${isStaff ? ' staff-pos' : ''}${isCounter ? ' counter-staff-app' : ''}${isInventoryStaff ? ' inventory-staff-app' : ''}`}>
            <SidebarScrimButton visible={drawerOpen} onClick={() => setDrawerOpen(false)} />

            <aside
                ref={sidebarRef}
                className={`admin-sidebar${drawerOpen ? ' sidebar-open' : ''}`}
                onScroll={(event) => { sidebarScrollRef.current = event.currentTarget.scrollTop; }}
            >
                <div className="sidebar-brand">
                    <Logo href={roleByKey(role)?.home} />
                    <SidebarCloseButton onClick={() => setDrawerOpen(false)} />
                </div>

                <div className="sidebar-label">{isCounter ? 'COUNTER STAFF' : isInventoryStaff ? 'INVENTORY STAFF' : roleLabel.toUpperCase()}</div>

                <nav className="sidebar-nav">
                    {items.map((item) => (
                        <NavLink key={item.path} to={`/${role}${item.path}`} end={item.path === '/dashboard' || item.path === '/pos'}>
                            <i className={`bi ${item.icon}`}></i>
                            <span>{item.label}</span>
                            {item.badge === 'pending' && pendingOrders ? <small>{pendingOrders}</small> : null}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    {canAccess(role, '/settings') ? (
                        <div className="sidebar-help">
                            <i className="bi bi-chat-dots"></i>
                            <b>Need a hand?</b>
                            <span>We&apos;re here to help your store grow.</span>
                            <NavLink to={`/${role}/settings`}>Get support <i className="bi bi-arrow-up-right"></i></NavLink>
                        </div>
                    ) : null}
                    <SidebarLogoutButton onClick={logout} />
                    <div className="sidebar-version">GUINHAWA {roleLabel.toUpperCase()} &middot; v1.0</div>
                </div>
            </aside>

            <div className="admin-main">
                <header className="admin-topbar">
                    <div className="topbar-left">
                        <SidebarToggleButton open={drawerOpen} onClick={() => setDrawerOpen((open) => !open)} />
                        <div className="topbar-context" aria-label="Current workspace and page">
                            <span className={`workspace-mode workspace-mode--${role}`}>
                                <i className={`bi ${isCounter ? 'bi-display' : isInventoryStaff ? 'bi-boxes' : 'bi-shield-check'}`}></i>
                                <span>
                                    <small>Workspace</small>
                                    <b>{isCounter ? 'Cashier' : isInventoryStaff ? 'Inventory' : 'Admin'}</b>
                                </span>
                            </span>
                            <span className="topbar-current-page">
                                <small>Current page</small>
                                <b>{title}</b>
                            </span>
                        </div>
                    </div>

                    <GlobalSearch pages={items} />

                    <div className="topbar-right">
                        <button
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title="Toggle Dark/Light Mode"
                        >
                            <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`}></i>
                        </button>
                        <TopbarClock />

                        <div className="popover-wrap" onMouseEnter={() => cancelClose('notif')} onMouseLeave={() => delayClose('notif', () => setNotifOpen(false))}>
                            <NotificationsButton unread={unread} open={notifOpen} onClick={() => setNotifOpen((open) => !open)} />
                            <Popover className="notification-popover" open={notifOpen}>
                                <div className="popover-heading">
                                    <b>Notifications</b>
                                    <MarkAllReadButton count={unread} onClick={() => setReadKeys(notifKeys)} />
                                </div>
                                {notifications.map((item) => {
                                    const key = `${item.title}|${item.body}`;
                                    return (
                                        <div className="notification-item" key={key}>
                                            <span className={`notification-icon ${item.tone}`}><i className={`bi ${item.icon}`}></i></span>
                                            <div>
                                                <b>{item.title}</b>
                                                <p>{item.body}</p>
                                                <small>{item.time}</small>
                                            </div>
                                            {readKeys.includes(key) ? null : <i className="notification-unread"></i>}
                                        </div>
                                    );
                                })}
                                {canAccess(role, '/history') ? (
                                    <NavLink className="popover-footer" to={`/${role}/history`}>
                                        {isStaff ? 'See inventory history' : 'See activity history'}
                                    </NavLink>
                                ) : null}
                            </Popover>
                        </div>

                        <div className="popover-wrap" onMouseEnter={() => cancelClose('profile')} onMouseLeave={() => delayClose('profile', () => setProfileOpen(false))}>
                            <ProfileMenuButton
                                session={session}
                                roleLabel={roleLabel}
                                open={profileOpen}
                                onClick={() => setProfileOpen((open) => !open)}
                            />
                            <Popover className="profile-popover" open={profileOpen}>
                                {canAccess(role, '/settings') ? (
                                    <>
                                        <NavLink to={`/${role}/settings`}><i className="bi bi-person"></i> Profile</NavLink>
                                        <NavLink to={`/${role}/settings`}><i className="bi bi-gear"></i> Settings</NavLink>
                                    </>
                                ) : null}
                                <ProfileLogoutButton onClick={logout} />
                            </Popover>
                        </div>
                    </div>
                </header>

                <main className="admin-content">
                    {children}
                    <footer className="admin-footer">
                        <span>&copy; 2026 Guinhawa Poultry Supply</span>
                        <span>Quality supplies. Healthy poultry. Happy farmers.</span>
                    </footer>
                </main>
            </div>
        </div>
    );
}
