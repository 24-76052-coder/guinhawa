import Button from '../Button.jsx';

/** Submits the cart and records the sale. Disabled until there is something to sell. */
export default function CompleteSaleButton({ disabled, onClick }) {
    return (
        <Button variant="primary pos-complete" disabled={disabled} onClick={onClick}>
            Done <i className="bi bi-arrow-right"></i>
        </Button>
    );
}
