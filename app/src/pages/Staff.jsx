import { useEffect, useMemo, useState } from 'react';
import {
    addStaffAccount,
    listStaffAccounts,
    removeStaffAccount,
    resetStaffPassword,
    setStaffStatus,
    updateStaffAccount,
} from '../auth.js';
import { confirmAction, formDialog, showError, showTemporaryPassword, toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead, StatusBadge } from '../components/ui.jsx';
import AddStaffButton from '../buttons/admin/AddStaffButton.jsx';
import ResetStaffPasswordButton from '../buttons/admin/ResetStaffPasswordButton.jsx';
import ToggleStaffStatusButton from '../buttons/admin/ToggleStaffStatusButton.jsx';
import DeleteRowButton from '../buttons/staff/DeleteRowButton.jsx';
import EditRowButton from '../buttons/staff/EditRowButton.jsx';

const ROLE_LABELS = {
    'counter-staff': 'Counter Staff / Cashier',
    'inventory-staff': 'Inventory Staff',
};

const ROLE_OPTIONS = [
    { value: 'counter-staff', label: 'Counter Staff / Cashier' },
    { value: 'inventory-staff', label: 'Inventory Staff' },
];

const ID_TYPE_OPTIONS = [
    { value: 'INV', label: 'Inventory Staff (INV)' },
    { value: 'CST', label: 'Counter Staff (CST)' },
];

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
];

function createFields() {
    return [
        { name: 'fullName', label: 'Full Name', required: true, placeholder: 'e.g. Juan Dela Cruz' },
        { name: 'idType', label: 'Employee ID Type', required: true, type: 'select', options: ID_TYPE_OPTIONS },
        { name: 'username', label: 'Username', required: true, placeholder: 'e.g. juan.delacruz' },
        { name: 'email', label: 'Email Address (optional)', type: 'email', placeholder: 'name@guinhawapoultry.com' },
        { name: 'contactNumber', label: 'Contact Number (optional)', placeholder: '09XX XXX XXXX' },
        {
            name: 'password',
            label: 'Password',
            type: 'password',
            placeholder: 'Leave blank to auto-generate',
        },
        {
            name: 'confirmPassword',
            label: 'Confirm Password',
            type: 'password',
            placeholder: 'Re-enter the password',
        },
        { name: 'status', label: 'Account Status', type: 'select', value: 'active', options: STATUS_OPTIONS },
    ];
}

function editFields(staff) {
    return [
        { name: 'fullName', label: 'Full Name', required: true, value: staff.name },
        { name: 'employeeId', label: 'Employee ID', required: true, value: staff.employeeId },
        { name: 'username', label: 'Username', required: true, value: staff.username },
        { name: 'email', label: 'Email Address (optional)', type: 'email', value: staff.email },
        { name: 'contactNumber', label: 'Contact Number (optional)', value: staff.contactNumber },
        { name: 'role', label: 'Employee Role', type: 'select', value: staff.role, options: ROLE_OPTIONS },
        { name: 'status', label: 'Account Status', type: 'select', value: staff.status, options: STATUS_OPTIONS },
    ];
}

function validateCommon(values, { creating }) {
    if (!values.fullName?.trim()) return 'Please enter the full name.';

    if (creating) {
        // When creating, employeeId is handled automatically based on idType selection.
        // We only need to verify a type is selected.
        if (!values.idType) return 'Please select an Employee ID Type.';
    } else {
        // When editing, we still validate the existing employeeId format.
        if (!/^[A-Za-z0-9-]{3,40}$/.test((values.employeeId || '').trim())) {
            return 'Employee ID must be at least 3 characters (letters, numbers and dashes).';
        }
    }

    if (!/^[A-Za-z0-9._-]{3,60}$/.test((values.username || '').trim())) {
        return 'Username must be at least 3 characters (letters, numbers, dots, underscores or dashes).';
    }
    if (values.email?.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) {
        return 'Please enter a valid email address.';
    }
    if (!STATUS_OPTIONS.some((option) => option.value === values.status)) {
        return 'Choose Active or Inactive.';
    }

    if (creating) {
        const password = values.password || '';
        const confirm = values.confirmPassword || '';
        if (password && (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
            return 'Password must be at least 8 characters and include a letter and a number.';
        }
        if (password !== confirm) return 'The two passwords do not match.';
        if (!password && confirm) return 'Leave both password fields blank to auto-generate one.';
    }
    return '';
}

export default function Staff() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const reload = () => setRefreshKey((value) => value + 1);

    useEffect(() => {
        let alive = true;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const rows = await listStaffAccounts({ search, role, status });
                if (!alive) return;
                setAccounts(rows);
                setLoadError('');
            } catch (error) {
                if (!alive) return;
                setAccounts([]);
                setLoadError(error.message || 'Could not load employee accounts.');
            } finally {
                if (alive) setLoading(false);
            }
        }, search ? 250 : 0);

        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [search, role, status, refreshKey]);

    const counts = useMemo(() => ({
        total: accounts.length,
        active: accounts.filter((staff) => staff.status === 'active').length,
        inactive: accounts.filter((staff) => staff.status === 'inactive').length,
    }), [accounts]);

    async function addStaff() {
        try {
            const values = await formDialog({
                title: 'Create Employee Account',
                fields: createFields(),
                confirmText: 'Create Account',
                validate: (form) => validateCommon(form, { creating: true }),
            });
            if (!values) return;

            // 1. Determine Role and Prefix based on Selection
            const prefix = values.idType; // 'INV' or 'CST'
            const role = prefix === 'INV' ? 'inventory-staff' : 'counter-staff';

            // 2. Generate automatic Employee ID
            // We fetch existing accounts to find the next available number
            const existingAccounts = await listStaffAccounts();
            const filteredIds = existingAccounts
                .filter(a => a.employeeId.startsWith(prefix))
                .map(a => parseInt(a.employeeId.split('-')[1]))
                .filter(num => !isNaN(num));

            const maxId = filteredIds.length > 0 ? Math.max(...filteredIds) : 0;
            const nextId = (maxId + 1).toString().padStart(3, '0');
            const employeeId = `${prefix}-${nextId}`;

            // Update values for API call
            const finalValues = {
                ...values,
                employeeId,
                role,
            };
            delete finalValues.idType; // Remove the helper field before sending to backend

            const result = await addStaffAccount(finalValues);
            if (result.generatedPassword && result.temporaryPassword) {
                await showTemporaryPassword({
                    name: result.account.name,
                    employeeId: result.account.employeeId,
                    username: result.account.username,
                    temporaryPassword: result.temporaryPassword,
                });
            } else {
                toast(`${result.account.name} created · ${result.account.employeeId}`, 'success');
            }
            reload();
        } catch (error) {
            showError(error);
        }
    }

    async function editStaff(staff) {
        try {
            const values = await formDialog({
                title: `Edit ${staff.name}`,
                fields: editFields(staff),
                confirmText: 'Save Changes',
                validate: (form) => validateCommon(form, { creating: false }),
            });
            if (!values) return;

            await updateStaffAccount(staff.id, values);
            toast(`${values.fullName.trim()} updated.`, 'success');
            reload();
        } catch (error) {
            showError(error);
        }
    }

    async function changeStatus(staff) {
        const nextStatus = staff.status === 'active' ? 'inactive' : 'active';
        const ok = await confirmAction({
            title: nextStatus === 'active' ? 'Activate this account?' : 'Deactivate this account?',
            text: nextStatus === 'active'
                ? `${staff.name} (${staff.employeeId}) will be able to sign in again.`
                : `${staff.name} (${staff.employeeId}) will be blocked from signing in immediately.`,
            confirmText: nextStatus === 'active' ? 'Activate' : 'Deactivate',
            icon: nextStatus === 'active' ? 'question' : 'warning',
        });
        if (!ok) return;
        try {
            await setStaffStatus(staff.id, nextStatus);
            toast(`${staff.name} is now ${nextStatus}.`, 'success');
            reload();
        } catch (error) {
            showError(error);
        }
    }

    async function resetPassword(staff) {
        const ok = await confirmAction({
            title: 'Reset this password?',
            text: `${staff.name} (${staff.employeeId}) will receive a new temporary password and must change it on the next sign-in.`,
            confirmText: 'Reset Password',
            icon: 'warning',
        });
        if (!ok) return;
        try {
            const temporaryPassword = await resetStaffPassword(staff.id);
            await showTemporaryPassword({
                name: staff.name,
                employeeId: staff.employeeId,
                username: staff.username,
                temporaryPassword,
            });
            reload();
        } catch (error) {
            showError(error);
        }
    }

    async function removeStaff(staff) {
        const ok = await confirmAction({
            title: 'Remove this employee account?',
            text: `${staff.name} (${staff.employeeId}) will no longer be able to sign in. This cannot be undone.`,
            confirmText: 'Remove',
        });
        if (!ok) return;
        try {
            await removeStaffAccount(staff.id);
            toast(`${staff.name} removed.`);
            reload();
        } catch (error) {
            showError(error);
        }
    }

    return (
        <>
            <PageHead
                title="User Management"
                subtitle="Create employee logins, assign Counter or Inventory roles, reset passwords, and control who can sign in."
                actions={<AddStaffButton onClick={addStaff} />}
            />

            <div className="admin-toolbar">
                <label className="admin-search catalog-search">
                    <i className="bi bi-search"></i>
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, username, employee ID, email, or contact..."
                        aria-label="Search employee accounts"
                    />
                </label>

                <label className="catalog-field catalog-category">
                    <span>Role</span>
                    <select className="admin-select" value={role} onChange={(event) => setRole(event.target.value)}>
                        <option value="">All roles</option>
                        <option value="counter-staff">Counter Staff / Cashier</option>
                        <option value="inventory-staff">Inventory Staff</option>
                    </select>
                </label>

                <label className="catalog-field">
                    <span>Status</span>
                    <select className="admin-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </label>
            </div>

            <div className="admin-panel">
                <div className="panel-heading">
                    <div>
                        <h2>Employee Accounts</h2>
                        <p>
                            {loading
                                ? 'Loading accounts...'
                                : `${counts.total} account${counts.total === 1 ? '' : 's'} shown · ${counts.active} active · ${counts.inactive} inactive`}
                        </p>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Employee ID</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6">
                                        <EmptyState icon="bi-arrow-repeat" title="Loading accounts" body="Reading employee accounts from the database..." />
                                    </td>
                                </tr>
                            ) : loadError ? (
                                <tr>
                                    <td colSpan="6">
                                        <EmptyState icon="bi-exclamation-triangle" title="Could not load accounts" body={loadError} />
                                    </td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan="6">
                                        <EmptyState
                                            icon="bi-people"
                                            title="No employee accounts found"
                                            body={search || role || status
                                                ? 'Try a different search term or filter.'
                                                : 'Create the first Counter or Inventory Staff login.'}
                                        />
                                    </td>
                                </tr>
                            ) : accounts.map((staff) => (
                                <tr key={staff.id}>
                                    <td>
                                        <span className="staff-cell">
                                            <span className="admin-avatar">{staff.avatar}</span>
                                            <span className="staff-meta">
                                                <b>{staff.name}</b>
                                                <small>{staff.contactNumber || staff.email || 'No contact on file'}</small>
                                            </span>
                                        </span>
                                    </td>
                                    <td className="muted-cell">{staff.employeeId}</td>
                                    <td>{staff.username}</td>
                                    <td>{ROLE_LABELS[staff.role] || staff.roleLabel}</td>
                                    <td><StatusBadge value={staff.status === 'active' ? 'Active' : 'Inactive'} /></td>
                                    <td>
                                        <div className="table-actions">
                                            <EditRowButton title={`Edit ${staff.name}`} onClick={() => editStaff(staff)} />
                                            <ResetStaffPasswordButton title={`Reset password for ${staff.name}`} onClick={() => resetPassword(staff)} />
                                            <ToggleStaffStatusButton
                                                active={staff.status === 'active'}
                                                title={staff.status === 'active' ? `Deactivate ${staff.name}` : `Activate ${staff.name}`}
                                                onClick={() => changeStatus(staff)}
                                            />
                                            <DeleteRowButton title={`Remove ${staff.name}`} onClick={() => removeStaff(staff)} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
