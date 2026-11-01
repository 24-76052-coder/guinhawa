import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import Guarded, { Denied } from './components/Guarded.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import { IntroAnimation } from './components/IntroAnimation.jsx';
import { CHANGE_PASSWORD_URL, LOGIN_URL, homeFor } from './roles.js';
import { refreshSession, useSession, useSessionResolved } from './auth.js';
import { useStoreReady } from './store.js';
import { clearIntroSkip, shouldSkipIntro } from './intro.js';
import { ThemeProvider } from './theme.jsx';
import logoSrc from './assets/logo.png';

import Attendance from './pages/Attendance.jsx';
import Customers from './pages/Customers.jsx';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import Inventory from './pages/Inventory.jsx';
import LowStock from './pages/LowStock.jsx';
import Orders from './pages/Orders.jsx';
import Pos from './pages/Pos.jsx';
import Products from './pages/Products.jsx';
import Receipt from './pages/Receipt.jsx';
import Receipts from './pages/Receipts.jsx';
import Sales from './pages/Sales.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Settings from './pages/Settings.jsx';
import Staff from './pages/Staff.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import InventoryStaffDashboard from './pages/InventoryStaffDashboard.jsx';
import ProductSearch from './pages/ProductSearch.jsx';
import { DamagedExpired, ExpirationMonitoring } from './pages/InventoryMonitoring.jsx';
import { StockInPage, StockOutPage } from './pages/StockMovement.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Reports from './pages/Reports.jsx';
import AuditLogs from './pages/AuditLogs.jsx';

/** Every panel page, with its sidebar title and the URL segment it lives on. */
const PAGES = [
    { segment: 'overview', title: 'Dashboard', Component: StaffDashboard },
    { segment: 'dashboard', title: 'Dashboard', Component: Dashboard },
    { segment: 'pos', title: 'POS / Sales', Component: Pos },
    { segment: 'available-stocks', title: 'Available Stocks', Component: ProductSearch, props: { title: 'Available Stocks' } },
    { segment: 'products', title: 'Products', Component: Products },
    { segment: 'inventory', title: 'Inventory', Component: Inventory },
    { segment: 'stock-in', title: 'Stock In', Component: StockInPage },
    { segment: 'stock-out', title: 'Stock Out', Component: StockOutPage },
    { segment: 'history', title: 'Inventory History', Component: History },
    { segment: 'customers', title: 'Customers', Component: Customers },
    { segment: 'staff', title: 'User Management', Component: Staff },
    { segment: 'orders', title: 'Orders', Component: Orders },
    { segment: 'sales', title: 'New Sale', Component: Sales },
    { segment: 'receipts', title: 'Receipts', Component: Receipts },
    { segment: 'sales-history', title: 'Sales History', Component: SalesHistory },
    { segment: 'attendance', title: 'Attendance', Component: Attendance },
    { segment: 'low-stock', title: 'Low Stock', Component: LowStock },
    { segment: 'expiration', title: 'Expiration Monitoring', Component: ExpirationMonitoring },
    { segment: 'damaged-expired', title: 'Damaged / Expired Products', Component: DamagedExpired },
    { segment: 'suppliers', title: 'Suppliers', Component: Suppliers },
    { segment: 'reports', title: 'Reports', Component: Reports },
    { segment: 'audit-logs', title: 'Audit Logs', Component: AuditLogs },
    { segment: 'settings', title: 'Settings', Component: Settings },
];

function NotFound() {
    return <Denied status={404} title="Page not found" message="The page you are looking for does not exist." />;
}

function LegacyStaffDashboardRedirect() {
    const session = useSession();
    const home = session?.role === 'inventory-staff' ? '/inventory-staff/overview' : '/counter-staff/overview';
    return <Navigate to={home} replace />;
}

export default function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const session = useSession();
    const sessionResolved = useSessionResolved();
    const storeReady = useStoreReady();
    const [loginIntroVisible, setLoginIntroVisible] = useState(location.pathname === LOGIN_URL);

    // Keep the cached profile in sync with MySQL. A reset password,
    // deactivation or role change therefore reaches tabs that are already open.
    useEffect(() => {
        refreshSession();
        const onFocus = () => refreshSession();
        const timer = window.setInterval(() => refreshSession(), 60000);
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', onFocus);
        };
    }, []);

    // A temporary password must be replaced before any workspace is opened.
    useEffect(() => {
        if (!session) {
            if (location.pathname === CHANGE_PASSWORD_URL) navigate(LOGIN_URL, { replace: true });
            return;
        }
        if (session.must_change_password) {
            if (location.pathname !== CHANGE_PASSWORD_URL) {
                navigate(CHANGE_PASSWORD_URL, { replace: true });
            }
            return;
        }
        if (location.pathname === CHANGE_PASSWORD_URL) {
            navigate(homeFor(session.role), { replace: true });
        }
    }, [session, location.pathname, navigate]);
    // Hand the splash logo over to the card logo. The shared `view-transition-name`
    // morphs it from centre-screen down into the card's brand mark; `flushSync`
    // commits the login page before the browser captures the "new" snapshot, and
    // `vt-logo-morph` drops the card's own entrance animations so that snapshot
    // is not taken while they are still at opacity 0. The class stays on while
    // this login page is mounted - removing it would restart those animations
    // and make the logo pop back in after the morph.
    const finishLoginIntro = useCallback(() => {
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (typeof document.startViewTransition !== 'function' || reduceMotion) {
            setLoginIntroVisible(false);
            return;
        }

        document.documentElement.classList.add('vt-logo-morph');
        document.startViewTransition(() => {
            flushSync(() => setLoginIntroVisible(false));
        });
    }, []);

    useEffect(() => {
        if (location.pathname === LOGIN_URL) {
            // Opening the app shows the splash; signing out does not. Layout
            // raises the skip flag before it navigates here.
            setLoginIntroVisible(!shouldSkipIntro());
            return;
        }

        // Any other route is a fresh start: drop the view-transition overrides
        // (so the next splash and the card's own entrance can run) and forget
        // the one-off logout skip.
        document.documentElement.classList.remove('vt-logo-morph', 'vt-logout');
        clearIntroSkip();
    }, [location.pathname]);

    // Wait for `/auth/me` (and, when signed in, the database snapshot) before
    // painting a route. This avoids showing the sign-in card to a user whose
    // session is still valid.
    const waitingForData = session && !session.must_change_password && !storeReady;
    if (!sessionResolved || waitingForData) {
        return (
            <ThemeProvider>
                <div className="admin-loading">
                    <span className="loading-mark"><img src={logoSrc} alt="Guinhawa Poultry Supply" /></span>
                    <span>Loading Guinhawa Poultry Supply…</span>
                    <span className="loading-track"><i /></span>
                </div>
            </ThemeProvider>
        );
    }

    const loginElement = loginIntroVisible
        ? <IntroAnimation onComplete={finishLoginIntro} />
        : <LoginPage />;

    return (
        <ThemeProvider>
            <div className="route-transition">
                <Routes location={location}>
                {/* The only sign-in page; no role selection step after login. */}
                <Route path={LOGIN_URL} element={loginElement} />

                {/* Required before a temporary password can open a workspace. */}
                <Route
                    path={CHANGE_PASSWORD_URL}
                    element={session ? <ChangePasswordPage /> : <Navigate to={LOGIN_URL} replace />}
                />

                {/* Old role-selection and per-role sign-in URLs go back to login. */}
                <Route path="/roles" element={<Navigate to={LOGIN_URL} replace />} />
                <Route path="/roles/:role" element={<Navigate to={LOGIN_URL} replace />} />
                <Route path="/:role/login" element={<Navigate to={LOGIN_URL} replace />} />
                <Route path="/:role/welcome" element={<Navigate to={LOGIN_URL} replace />} />
                <Route path="/receipt/:id" element={<Navigate to={LOGIN_URL} replace />} />

                <Route path="/:role/receipt/:id" element={<Receipt />} />

                {/* The cashier gets their own dashboard; the old staff-dashboard
                    address now points at it instead of the POS. */}
                <Route path="/staff/dashboard" element={<LegacyStaffDashboardRedirect />} />

                {PAGES.map((page) => (
                    <Route
                        key={page.segment}
                        path={`/:role/${page.segment}`}
                        element={
                            <Guarded accessPath={`/${page.segment}`} title={page.title}>
                                <page.Component {...page.props} />
                            </Guarded>
                        }
                    />
                ))}

                {/* /admin and /staff on their own go back to the Login page,
                    which forwards an existing session straight to page 2. */}
                <Route path="/:role" element={<Navigate to={LOGIN_URL} replace />} />

                <Route path="*" element={<NotFound />} />
            </Routes>
        </div>
        </ThemeProvider>
    );
}
