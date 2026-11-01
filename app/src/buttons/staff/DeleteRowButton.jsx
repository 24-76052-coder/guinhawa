import Button from '../Button.jsx';

/** Trash icon in the row-actions cell. Kept red by `.table-actions button.danger`. */
export default function DeleteRowButton({ title, onClick }) {
    return (
        <Button variant="row danger" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-trash"></i>
        </Button>
    );
}
