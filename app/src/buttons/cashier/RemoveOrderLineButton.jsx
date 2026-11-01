import Button from '../Button.jsx';

/** Drops one line from the counter order. */
export default function RemoveOrderLineButton({ name, onClick }) {
    return (
        <Button variant="cpos-line-remove" aria-label={`Remove ${name}`} onClick={onClick}>
            <i className="bi bi-x-lg"></i>
        </Button>
    );
}
