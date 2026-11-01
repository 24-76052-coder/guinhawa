import Button from '../Button.jsx';

/** Bordered eye icon used for "view details" in table action cells. */
export default function ViewDetailsButton({ title = 'View details', onClick }) {
    return (
        <Button variant="icon" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-eye"></i>
        </Button>
    );
}
