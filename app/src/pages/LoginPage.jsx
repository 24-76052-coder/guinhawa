import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, useSession } from '../auth.js';
import { CHANGE_PASSWORD_URL, homeFor } from '../roles.js';
import { ADMIN_WELCOME_KEY, warmWelcomeVoice } from '../components/AdminWelcome.jsx';
import RevealPasswordButton from '../buttons/admin/RevealPasswordButton.jsx';
import LoginSubmitButton from '../buttons/admin/LoginSubmitButton.jsx';
import logoSrc from '../assets/logo.png';

/**
 * The single sign-in screen. There is no public sign-up: every employee
 * account is created by an administrator, and the account's assigned role
 * decides which dashboard opens.
 */
export default function LoginPage() {
    const session = useSession();
    const navigate = useNavigate();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [reveal, setReveal] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const identifierRef = useRef(null);

    useEffect(() => {
        document.title = 'Login | Guinhawa Poultry Supply';
    }, []);

    // Already signed in: reopen that account's workspace (or finish a
    // temporary-password change first).
    useEffect(() => {
        if (!session?.role) return;
        navigate(
            session.must_change_password ? CHANGE_PASSWORD_URL : homeFor(session.role),
            { replace: true },
        );
    }, [session, navigate]);

    useEffect(() => {
        identifierRef.current?.focus();
    }, []);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        warmWelcomeVoice();
        setError('');
        setBusy(true);
        try {
            const next = await signIn(identifier, password);
            if (next.role === 'admin') {
                try {
                    sessionStorage.setItem(ADMIN_WELCOME_KEY, '1');
                } catch {
                    /* storage disabled */
                }
            }
            navigate(
                next.must_change_password ? CHANGE_PASSWORD_URL : homeFor(next.role),
                { replace: true },
            );
        } catch (err) {
            setError(err.message || 'Sign-in failed. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="gp-auth gp-login-screen">
            <main className="gp-flip">
                <div className="gp-flip-inner">
                    <div className="gp-card gp-card-face gp-card-face-front gp-signin">
                        <header className="gp-login-brand">
                            <img src={logoSrc} alt="Guinhawa Poultry Supply" />
                            <span>GUINHAWA POULTRY SUPPLY</span>
                        </header>

                        <h1 className="gp-title">Sign in</h1>
                        <p className="gp-sub">Enter your username or employee ID and password to continue.</p>

                        <form onSubmit={submit} noValidate>
                            <label className="gp-field" htmlFor="gp-identifier">
                                <span>Username / Employee ID</span>
                                <span className={`gp-input${error ? ' has-error' : ''}`}>
                                    <i className="bi bi-person-badge"></i>
                                    <input
                                        id="gp-identifier"
                                        ref={identifierRef}
                                        type="text"
                                        value={identifier}
                                        onChange={(event) => setIdentifier(event.target.value)}
                                        placeholder="e.g. sofia or CST-001"
                                        autoComplete="username"
                                        autoFocus
                                    />
                                </span>
                            </label>

                            <label className="gp-field" htmlFor="gp-password">
                                <span>Password</span>
                                <span className={`gp-input${error ? ' has-error' : ''}`}>
                                    <i className="bi bi-lock"></i>
                                    <input
                                        id="gp-password"
                                        type={reveal ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                    />
                                    <RevealPasswordButton visible={reveal} onClick={() => setReveal((value) => !value)} />
                                </span>
                            </label>

                            {error ? (
                                <p className="gp-error" role="alert">
                                    <i className="bi bi-exclamation-circle"></i>
                                    {error}
                                </p>
                            ) : null}

                            <LoginSubmitButton disabled={busy} />

                            <p className="gp-swap">
                                Accounts are created by the administrator.
                            </p>
                        </form>

                        <footer className="gp-card-footer">
                            <span className="gp-card-footer-rule" aria-hidden="true"></span>
                            <span className="gp-card-footer-name">GUINHAWA POULTRY SUPPLY</span>
                            <span className="gp-card-footer-tag">Healthy Poultry, Better Tomorrow</span>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
}
