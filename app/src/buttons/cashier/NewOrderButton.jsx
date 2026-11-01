import Button from '../Button.jsx';

/** Starts a fresh order straight from the "sale complete" banner. */
export default function NewOrderButton({ onClick }) {
    return (
        <Button onClick={onClick}>
            <i className="bi bi-check-lg"></i> Done
        </Button>
    );
}
