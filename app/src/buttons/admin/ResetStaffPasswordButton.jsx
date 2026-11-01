import Button from '../Button.jsx';

/** Key icon in the User Management row actions. */
export default function ResetStaffPasswordButton({ title, onClick }) {
    return (
        <Button variant="row" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-key"></i>
        </Button>
    );
}
