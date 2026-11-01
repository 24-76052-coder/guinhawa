import Button from '../Button.jsx';

/** Opens the stock adjustment dialog from the inventory table. */
export default function AdjustStockButton({ onClick }) {
    return (
        <Button variant="row" title="Adjust stock" aria-label="Adjust stock" onClick={onClick}>
            <i className="bi bi-pencil"></i>
        </Button>
    );
}
