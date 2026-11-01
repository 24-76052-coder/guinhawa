import Button from '../Button.jsx';

/**
 * Submits the stock-in / stock-out form. The class swap keeps the existing
 * red styling for stock-out moves.
 */
export default function StockSubmitButton({ stockIn, label, disabled, onClick }) {
    return (
        <Button variant={`primary${stockIn ? '' : ' stock-out-button'}`} disabled={disabled} onClick={onClick}>
            <i className="bi bi-plus-lg"></i> {label}
        </Button>
    );
}
