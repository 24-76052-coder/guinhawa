import Button from '../Button.jsx';

/** Page-head primary action on the shared Products screen. */
export default function AddProductButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-plus-lg"></i> Add Product
        </Button>
    );
}
