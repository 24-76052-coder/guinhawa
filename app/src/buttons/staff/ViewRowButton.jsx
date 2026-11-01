import Button from '../Button.jsx';

/** Eye icon in the row-actions cell (products, customers). */
export default function ViewRowButton({ title, onClick }) {
    return (
        <Button variant="row" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-eye"></i>
        </Button>
    );
}
