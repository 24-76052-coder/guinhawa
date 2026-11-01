import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth.js';
import { formDialog, showError, toast } from './dialogs.jsx';
import { store } from '../store.js';
import QuickActionButton from '../buttons/admin/QuickActionButton.jsx';

const SUPPLIER_FIELDS = [
    { name: 'name', label: 'Supplier Name', required: true, placeholder: 'e.g. Bulacan Farm Supply' },
    { name: 'contact', label: 'Contact Number', required: true, placeholder: '09XX XXX XXXX' },
    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Optional' },
    { name: 'address', label: 'Address', placeholder: 'e.g. Malolos, Bulacan' },
];

function validateSupplier(values) {
    if (!values.name?.trim()) return 'Please enter the supplier name.';
    if (!values.contact?.trim()) return 'Please enter a contact number.';
    return '';
}

/**
 * The Quick Actions panel, shared by the admin and staff dashboards. Every
 * button jumps to the page that owns its form; Add Supplier opens its dialog
 * here. Add Product and Add Supplier are admin only, so the cashier sees just
 * the stock shortcuts they are allowed to use.
 */
export default function QuickActions() {
    const navigate = useNavigate();
    const session = useSession();
    const role = session?.role || 'admin';
    const isAdmin = role === 'admin';

    async function addSupplier() {
        try {
            const values = await formDialog({
                title: 'Add Supplier',
                fields: SUPPLIER_FIELDS,
                confirmText: 'Add Supplier',
                validate: validateSupplier,
            });
            if (!values) return;
            await store.addSupplier(values);
            toast('Supplier added.');
        } catch (error) {
            showError(error);
        }
    }

    const actions = [
        isAdmin && { tone: 'tone-green', icon: 'bi-plus-lg', label: 'Add Product', hint: 'List a new item', onClick: () => navigate(`/${role}/products`) },
        { tone: 'tone-blue', icon: 'bi-arrow-down', label: 'Stock In', hint: 'Record new supplies', onClick: () => navigate(`/${role}/stock-in`) },
        { tone: 'tone-orange', icon: 'bi-arrow-up', label: 'Stock Out', hint: 'Record a stock removal', onClick: () => navigate(`/${role}/stock-out`) },
        isAdmin && { tone: 'tone-purple', icon: 'bi-truck', label: 'Add Supplier', hint: 'Add a new supplier', onClick: addSupplier },
    ].filter(Boolean);

    return (
        <section className="admin-panel quick-panel">
            <div className="panel-heading">
                <div>
                    <h2>Quick Actions</h2>
                    <p>Shortcuts for your store day</p>
                </div>
            </div>
            <div className="quick-tiles">
                {actions.map((action) => (
                    <QuickActionButton
                        key={action.label}
                        tone={action.tone}
                        icon={action.icon}
                        label={action.label}
                        hint={action.hint}
                        onClick={action.onClick}
                    />
                ))}
            </div>
        </section>
    );
}
