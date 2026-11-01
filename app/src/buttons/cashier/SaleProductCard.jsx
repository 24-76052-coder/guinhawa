import { money } from '../../store.js';
import Button from '../Button.jsx';

/** Whole-product card in the admin "New Sale" grid - one click adds it to the cart. */
export default function SaleProductCard({ product, soldOut, remaining, onClick }) {
    return (
        <Button variant={`pos-product-card${soldOut ? ' is-out' : ''}`} onClick={onClick}>
            <span className="pos-product-icon"><i className="bi bi-box-seam"></i></span>
            <span className="pos-product-info">
                <b>{product.name}</b>
                <small>{product.category} · {product.unit}</small>
            </span>
            <span className="pos-product-price">
                <b>{money(product.price)}</b>
                <small>{soldOut ? 'Out of stock' : `${remaining} left`}</small>
            </span>
        </Button>
    );
}
