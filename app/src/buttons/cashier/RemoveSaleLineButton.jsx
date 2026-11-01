import Button from '../Button.jsx';

/** Drops one line from the admin New Sale cart. */
export default function RemoveSaleLineButton({ onClick }) {
    return (
        <Button variant="icon" title="Remove" aria-label="Remove from cart" onClick={onClick}>
            <i className="bi bi-trash3"></i>
        </Button>
    );
}
