import Button from '../Button.jsx';

/** Opens the browser print dialog for the receipt. */
export default function PrintReceiptButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-printer"></i> Print receipt
        </Button>
    );
}
