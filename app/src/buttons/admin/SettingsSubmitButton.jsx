import Button from '../Button.jsx';

/** Primary submit used by every settings form. */
export default function SettingsSubmitButton({ label, disabled }) {
    return (
        <Button type="submit" variant="primary" disabled={disabled}>
            {label}
        </Button>
    );
}
