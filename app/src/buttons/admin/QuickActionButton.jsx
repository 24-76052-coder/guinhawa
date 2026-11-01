import Button from '../Button.jsx';

/**
 * One shortcut on the dashboard's Quick Actions row: a toned tile with a line
 * icon and a bold label. `tone` is passed straight through as a class name
 * ("tone-green" and friends are styled in app.css).
 */
export default function QuickActionButton({ icon, label, hint, tone, onClick }) {
    return (
        <Button variant={`quick-tile ${tone || ''}`} onClick={onClick} title={hint || label}>
            <i className={`bi ${icon}`}></i>
            <span><b>{label}</b></span>
        </Button>
    );
}
