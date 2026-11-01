import Button from '../Button.jsx';

/** Page-head primary action on the admin Customers screen. */
export default function AddCustomerButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-person-plus"></i> Add Customer
        </Button>
    );
}
