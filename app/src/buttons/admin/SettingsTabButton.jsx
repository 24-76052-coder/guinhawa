import Button from '../Button.jsx';

/** Section tab across the top of the settings panel. */
export default function SettingsTabButton({ active, label, onClick }) {
    return (
        <Button variant={active ? 'active' : ''} aria-pressed={active} onClick={onClick}>
            {label}
        </Button>
    );
}
