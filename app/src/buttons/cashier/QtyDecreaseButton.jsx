import Button from '../Button.jsx';

/** Minus stepper shared by the counter POS and the admin New Sale cart. */
export default function QtyDecreaseButton({ name, onClick }) {
    return (
        <Button aria-label={`Decrease quantity of ${name}`} onClick={onClick}>
            <i className="bi bi-dash-lg"></i>
        </Button>
    );
}
