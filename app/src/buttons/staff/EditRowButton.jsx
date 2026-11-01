import Button from '../Button.jsx';

/** Pencil icon in the row-actions cell (products, customers). */
export default function EditRowButton({ title, onClick }) {
    return (
        <Button variant="row" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-pencil"></i>
        </Button>
    );
}
