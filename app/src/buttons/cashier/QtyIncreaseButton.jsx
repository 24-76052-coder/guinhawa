import Button from '../Button.jsx';

/** Plus stepper shared by the counter POS and the admin New Sale cart. */
export default function QtyIncreaseButton({ name, onClick }) {
    return (
        <Button aria-label={`Increase quantity of ${name}`} onClick={onClick}>
            <i className="bi bi-plus-lg"></i>
        </Button>
    );
}
