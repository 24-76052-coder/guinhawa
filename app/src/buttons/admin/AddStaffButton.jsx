import Button from '../Button.jsx';

/** Page-head primary action on the admin Staff screen. */
export default function AddStaffButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-person-plus"></i> Add Staff
        </Button>
    );
}
