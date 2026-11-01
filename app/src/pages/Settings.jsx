import { useState } from 'react';
import { store, useStore } from '../store.js';
import { changePassword, useSession } from '../auth.js';
import { notify, toast } from '../components/dialogs.jsx';
import { PageHead } from '../components/ui.jsx';
import { roleByKey } from '../roles.js';
import ChangePhotoButton from '../buttons/admin/ChangePhotoButton.jsx';
import SettingsSubmitButton from '../buttons/admin/SettingsSubmitButton.jsx';
import SettingsTabButton from '../buttons/admin/SettingsTabButton.jsx';

const TABS = [
    { key: 'store', label: 'Store Information' },
    { key: 'profile', label: 'Profile' },
    { key: 'system', label: 'System Settings' },
    { key: 'backup', label: 'Backup & Restore' },
];

export default function Settings() {
    const state = useStore();
    const session = useSession();
    const [tab, setTab] = useState('store');

    const [storeForm, setStoreForm] = useState({ ...state.settings });
    const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
    const [savingPassword, setSavingPassword] = useState(false);
    const roleLabel = roleByKey(session?.role)?.label || session?.role || 'Account';
    const [systemForm, setSystemForm] = useState({
        threshold: state.settings.low_stock_threshold ?? 10,
        currency: 'PHP',
        dateFormat: 'MMM DD, YYYY',
        emailNotif: true,
        invAlerts: true,
        orderNotif: true,
    });

    async function saveStore(event) {
        event.preventDefault();
        try {
            await store.saveSettings(storeForm);
            toast('Store information saved.');
        } catch (error) {
            notify('Could not save store information', error.message || 'Please try again.', 'error');
        }
    }

    function uploadGcashQr(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            notify('Invalid QR image', 'Please select a PNG, JPG, or WebP image.', 'error');
            event.target.value = '';
            return;
        }
        if (file.size > 1024 * 1024) {
            notify('QR image is too large', 'Please choose an image smaller than 1 MB.', 'error');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setStoreForm((form) => ({ ...form, gcash_qr: String(reader.result || '') }));
        reader.onerror = () => notify('QR upload failed', 'The selected image could not be read.', 'error');
        reader.readAsDataURL(file);
    }

    async function savePassword(event) {
        event.preventDefault();
        const { current, next, confirm } = passwordForm;

        if (!current) {
            notify('Password required', 'Enter your current password first.', 'warning');
            return;
        }
        if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
            notify('Weak password', 'The new password must be at least 8 characters and include a letter and a number.', 'warning');
            return;
        }
        if (next !== confirm) {
            notify('Passwords do not match', 'Please re-enter the same new password.', 'warning');
            return;
        }

        setSavingPassword(true);
        try {
            await changePassword(current, next);
            setPasswordForm({ current: '', next: '', confirm: '' });
            toast('Password updated.');
        } catch (error) {
            notify('Could not update password', error.message || 'Please try again.', 'error');
        } finally {
            setSavingPassword(false);
        }
    }

    async function saveSystem(event) {
        event.preventDefault();
        try {
            await store.saveSettings({
                low_stock_threshold: Number(systemForm.threshold) || 10,
                currency: systemForm.currency,
                date_format: systemForm.dateFormat,
                email_notifications: systemForm.emailNotif,
                inventory_alerts: systemForm.invAlerts,
                order_notifications: systemForm.orderNotif,
            });
            toast('System settings saved.');
        } catch (error) {
            notify('Could not save system settings', error.message || 'Please try again.', 'error');
        }
    }

    function backupData() {
        const snapshot = store.getState();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `guinhawa-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast('Local data backup downloaded.');
    }

    function restoreData(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                if (!parsed.products || !parsed.sales || !parsed.orders) throw new Error('This is not a valid Guinhawa backup file.');
                await store.restoreState(parsed);
                toast('Backup restored. The page data is now synchronized.');
            } catch (error) {
                notify('Restore failed', error.message || 'The backup file could not be read.', 'error');
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    return (
        <>
            <PageHead
                title="Settings"
                subtitle="Keep your store details, preferences, and profile up to date."
            />

            <div className="settings-tabs">
                {TABS.map((item) => (
                    <SettingsTabButton
                        key={item.key}
                        active={tab === item.key}
                        label={item.label}
                        onClick={() => setTab(item.key)}
                    />
                ))}
            </div>

            <div className="admin-panel settings-panel">
                {tab === 'store' ? (
                    <div className="settings-section">
                        <div className="panel-heading">
                            <div>
                                <h2>Store Information</h2>
                                <p>These details help customers find your location and reach your store</p>
                            </div>
                        </div>
                        <form className="settings-form" onSubmit={saveStore}>
                            <label>Store Name
                                <input value={storeForm.store_name} onChange={(event) => setStoreForm({ ...storeForm, store_name: event.target.value })} required />
                            </label>
                            <div className="settings-two">
                                <label>Email Address
                                    <input type="email" value={storeForm.email} onChange={(event) => setStoreForm({ ...storeForm, email: event.target.value })} required />
                                </label>
                                <label>Phone Number
                                    <input value={storeForm.phone} onChange={(event) => setStoreForm({ ...storeForm, phone: event.target.value })} required />
                                </label>
                            </div>
                            <label>Physical Address
                                <input value={storeForm.address} onChange={(event) => setStoreForm({ ...storeForm, address: event.target.value })} required />
                            </label>
                            <label>Business Operating Hours
                                <input value={storeForm.business_hours} onChange={(event) => setStoreForm({ ...storeForm, business_hours: event.target.value })} required />
                            </label>
                            <label>Store Description / Tagline
                                <textarea value={storeForm.description} onChange={(event) => setStoreForm({ ...storeForm, description: event.target.value })} />
                            </label>
                            <div className="gcash-qr-setting">
                                <div>
                                    <b>GCash QR Code</b>
                                    <p>Upload the QR image to show when GCash is selected at checkout.</p>
                                </div>
                                {storeForm.gcash_qr ? (
                                    <img src={storeForm.gcash_qr} alt="GCash QR code" className="gcash-qr-preview" />
                                ) : (
                                    <div className="gcash-qr-empty"><i className="bi bi-qr-code"></i><span>No QR uploaded</span></div>
                                )}
                                <div className="gcash-qr-actions">
                                    <label className="admin-soft">
                                        <i className="bi bi-upload"></i>
                                        {storeForm.gcash_qr ? 'Change QR' : 'Upload QR'}
                                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadGcashQr} />
                                    </label>
                                    {storeForm.gcash_qr ? (
                                        <button type="button" className="admin-soft gcash-qr-remove" onClick={() => setStoreForm({ ...storeForm, gcash_qr: '' })}>
                                            <i className="bi bi-trash"></i> Remove
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <SettingsSubmitButton label="Save Changes" />
                        </form>
                    </div>
                ) : null}

                {tab === 'profile' ? (
                    <div className="settings-section">
                        <div className="panel-heading">
                            <div>
                                <h2>{roleLabel} Profile</h2>
                                <p>Your employee account is managed by the administrator.</p>
                            </div>
                        </div>
                        <div className="profile-edit">
                            <span className="admin-avatar large">{session?.avatar}</span>
                            <ChangePhotoButton
                                onClick={() => notify('Avatar', 'Photo upload will be enabled with file storage in the next release.', 'info')}
                            />
                        </div>
                        <form className="settings-form" onSubmit={savePassword}>
                            <div className="settings-two">
                                <label>Full Name
                                    <input value={session?.name || ''} readOnly />
                                </label>
                                <label>Username
                                    <input value={session?.loginUsername || ''} readOnly />
                                </label>
                            </div>
                            <div className="settings-two">
                                <label>Employee ID
                                    <input value={session?.employeeId || ''} readOnly />
                                </label>
                                <label>Role
                                    <input value={roleLabel} readOnly />
                                </label>
                            </div>
                            <label>Contact Email
                                <input value={session?.email || '—'} readOnly />
                            </label>
                            <label>Current Password
                                <input
                                    type="password"
                                    placeholder="Enter your current password"
                                    value={passwordForm.current}
                                    onChange={(event) => setPasswordForm({ ...passwordForm, current: event.target.value })}
                                    autoComplete="current-password"
                                />
                            </label>
                            <div className="settings-two">
                                <label>New Password
                                    <input
                                        type="password"
                                        placeholder="At least 8 characters"
                                        value={passwordForm.next}
                                        onChange={(event) => setPasswordForm({ ...passwordForm, next: event.target.value })}
                                        autoComplete="new-password"
                                    />
                                </label>
                                <label>Confirm New Password
                                    <input
                                        type="password"
                                        placeholder="Re-enter the new password"
                                        value={passwordForm.confirm}
                                        onChange={(event) => setPasswordForm({ ...passwordForm, confirm: event.target.value })}
                                        autoComplete="new-password"
                                    />
                                </label>
                            </div>
                            <SettingsSubmitButton label={savingPassword ? 'Updating...' : 'Change Password'} disabled={savingPassword} />
                        </form>
                    </div>
                ) : null}

                {tab === 'system' ? (
                    <div className="settings-section">
                        <div className="panel-heading">
                            <div>
                                <h2>System Settings</h2>
                                <p>Set inventory thresholds and store notifications</p>
                            </div>
                        </div>
                        <form className="settings-form" onSubmit={saveSystem}>
                            <div className="settings-two">
                                <label>Low Stock Warning Threshold
                                    <input
                                        type="number"
                                        min="1"
                                        value={systemForm.threshold}
                                        onChange={(event) => setSystemForm({ ...systemForm, threshold: event.target.value })}
                                        required
                                    />
                                </label>
                                <label>Default Currency
                                    <select value={systemForm.currency} onChange={(event) => setSystemForm({ ...systemForm, currency: event.target.value })}>
                                        <option value="PHP">PHP · Philippine Peso (₱)</option>
                                        <option value="USD">USD · US Dollar ($)</option>
                                    </select>
                                </label>
                            </div>
                            <label>Date Display Format
                                <select value={systemForm.dateFormat} onChange={(event) => setSystemForm({ ...systemForm, dateFormat: event.target.value })}>
                                    <option value="MMM DD, YYYY">MMM DD, YYYY (e.g. Sept 24, 2026)</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </label>
                            <div className="settings-checks">
                                <label>
                                    <input type="checkbox" checked={systemForm.emailNotif} onChange={(event) => setSystemForm({ ...systemForm, emailNotif: event.target.checked })} />
                                    Email notifications for customer orders
                                </label>
                                <label>
                                    <input type="checkbox" checked={systemForm.invAlerts} onChange={(event) => setSystemForm({ ...systemForm, invAlerts: event.target.checked })} />
                                    In-app alerts when stock reaches low threshold
                                </label>
                                <label>
                                    <input type="checkbox" checked={systemForm.orderNotif} onChange={(event) => setSystemForm({ ...systemForm, orderNotif: event.target.checked })} />
                                    Audio or popup notifications on new inquiry
                                </label>
                            </div>
                            <SettingsSubmitButton label="Save Changes" />
                        </form>
                    </div>
                ) : null}

                {tab === 'backup' ? (
                    <div className="settings-section">
                        <div className="panel-heading">
                            <div>
                                <h2>Database Backup & Restore</h2>
                                <p>Download a local copy of all system records or restore a previously saved backup.</p>
                            </div>
                        </div>
                        <div className="settings-form">
                            <div className="settings-two">
                                <button type="button" className="admin-primary" onClick={backupData}>
                                    <i className="bi bi-download"></i> Download Backup
                                </button>
                                <label className="admin-soft">
                                    <i className="bi bi-upload"></i> Restore Backup
                                    <input type="file" accept="application/json,.json" onChange={restoreData} />
                                </label>
                            </div>
                            <p className="muted-cell">The backup includes products, inventory movements, sales, orders, suppliers, staff settings, attendance references, and audit records.</p>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}
