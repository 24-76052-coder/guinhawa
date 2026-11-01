import Button from '../Button.jsx';

/** Empties the current cart on both sale screens. */
export default function ClearCartButton({ disabled, onClick }) {
    return (
        <Button variant="soft" disabled={disabled} onClick={onClick}>
            <i className="bi bi-trash3"></i> Clear
        </Button>
    );
}
