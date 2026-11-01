import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../auth.js';
import { LOGIN_URL, canAccess, roleByKey } from '../roles.js';
import Layout from './Layout.jsx';

/**
 * The plain 401 / 403 / 404 card the old PHP error_page() printed, kept inline
 * so there is no stylesheet dependency.
 */
export function Denied({ status = 403, title, message }) {
    const navigate = useNavigate();
    const session = useSession();
    const home = session ? roleByKey(session.role)?.home : '/';
    const label = session ? 'Back to my dashboard' : 'Go to login';

    return (
        <div className="error-page">
            <div className="error-card">
                <h1>
                    {status} {title}
                </h1>
                <p>{message}</p>
                <a href={home || '/'} onClick={(event) => { event.preventDefault(); navigate(home || '/'); }}>
                    {label}
                </a>
            </div>
        </div>
    );
}

/**
 * Route guard, checked in this order: known role -> signed in -> right role ->
 * allowed page for that role.
 *
 * `accessPath` is the role-relative path used by PAGE_ACCESS ('/dashboard'),
 * while the URL itself carries the role segment ('/admin/dashboard').
 */
export default function Guarded({ accessPath, title, children }) {
    const { role } = useParams();
    const session = useSession();
    const location = useLocation();

    const roleInfo = roleByKey(role);
    if (!roleInfo) {
        return <Denied status={404} title="Page not found" message="There is no workspace at this address." />;
    }
    const canonicalRole = roleInfo.key;

    if (!session) {
        return <Denied status={401} title="Please sign in" message={`Sign in with your ${roleInfo.label} account to open this page.`} />;
    }

    // A session without a workspace cannot open a panel.
    if (!session.role) {
        return <Navigate to={LOGIN_URL} replace />;
    }

    if (session.role !== canonicalRole) {
        return (
            <Denied
                status={403}
                title="Access denied"
                message={`The ${roleInfo.label} workspace belongs to another role. Open your own dashboard instead.`}
            />
        );
    }

    if (!canAccess(canonicalRole, accessPath)) {
        return <Denied status={403} title="Access denied" message={`Your ${roleInfo.label} account cannot open ${location.pathname}.`} />;
    }

    return <Layout title={title}>{children}</Layout>;
}
