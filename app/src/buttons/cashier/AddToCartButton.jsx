import Button from '../Button.jsx';

/** Add / add-another button under a counter product card. */
export default function AddToCartButton({ disabled, inCartQty, onClick }) {
    return (
        <Button variant="cpos-add" disabled={disabled} onClick={onClick}>
            <i className={`bi ${inCartQty ? 'bi-plus-lg' : 'bi-cart-plus'}`}></i>
            {inCartQty ? `In order (${inCartQty})` : 'Add'}
        </Button>
    );
}
