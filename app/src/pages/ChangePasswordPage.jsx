import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, signOut, useSession } from '../auth.js';
import { homeFor, LOGIN_URL } from '../roles.js';
import { skipIntroAfterLogout } from '../intro.js';
import ChangePasswordSubmitButton from '../buttons/admin/ChangePasswordSubmitButton.jsx';
import ChangePasswordLogoutButton from '../buttons/admin/ChangePasswordLogoutButton.jsx';
import logoSrc from '../assets/logo.png';

/**
 * First-login gate. The administrator gives an employee a temporary password;
 * the server flags the account until the employee replaces it. No workspace
 * route can be opened while this flag is set.
 */
export default function ChangePasswordPage() {
    const session = useSession();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const firstRef = useRef(null);

    useEffect(() => {
        document.title = 'Change password | Guinhawa Poultry Supply';
        firstRef.current?.focus();
    }, []);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setError('');

        if (!currentPassword) {
            setError('Please enter your temporary/current password.');
            return;
        }
        if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setError('The new password must be at least 8 characters and include a letter and a number.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('The new passwords do not match. Please try again.');
            return;
        }

        setBusy(true);
        try {
            const next = await changePassword(currentPassword, newPassword);
            navigate(homeFor(next.role), { replace: true });
        } catch (err) {
            setError(err.message || 'Could not change your password. Please try again.');
        } finally {
            setBusy(false);
        }
    }

    function cancel() {
        skipIntroAfterLogout();
        signOut();
        navigate(LOGIN_URL, { replace: true });
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

                        <h1 className="gp-title">Change your password</h1>
                        <p className="gp-sub">
                            {session?.name ? `${session.name}, your` : 'Your'} temporary password must be replaced before you can continue.
                        </p>

                        <form onSubmit={submit} noValidate>
                            <label className="gp-field" htmlFor="gp-current-password">
                                <span>Temporary / Current Password</span>
                                <span className={`gp-input${error ? ' has-error' : ''}`}>
                                    <i className="bi bi-lock"></i>
                                    <input
                                        id="gp-current-password"
                                        ref={firstRef}
                                        type="password"
                                        value={currentPassword}
                                        onChange={(event) => setCurrentPassword(event.target.value)}
                                        placeholder="Password from the administrator"
                                        autoComplete="current-password"
                                    />
                                </span>
                            </label>

                            <label className="gp-field" htmlFor="gp-new-password">
                                <span>New Password</span>
                                <span className={`gp-input${error ? ' has-error' : ''}`}>
                                    <i className="bi bi-shield-lock"></i>
                                    <input
                                        id="gp-new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        placeholder="At least 8 characters"
                                        autoComplete="new-password"
                                    />
                                </span>
                            </label>

                            <label className="gp-field" htmlFor="gp-confirm-password">
                                <span>Confirm New Password</span>
                                <span className={`gp-input${error ? ' has-error' : ''}`}>
                                    <i className="bi bi-shield-check"></i>
                                    <input
                                        id="gp-confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        placeholder="Re-enter the new password"
                                        autoComplete="new-password"
                                    />
                                </span>
                            </label>

                            {error ? (
                                <p className="gp-error" role="alert">
                                    <i className="bi bi-exclamation-circle"></i>
                                    {error}
                                </p>
                            ) : null}

                            <ChangePasswordSubmitButton disabled={busy} />

                            <p className="gp-swap">
                                <ChangePasswordLogoutButton onClick={cancel} />
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
