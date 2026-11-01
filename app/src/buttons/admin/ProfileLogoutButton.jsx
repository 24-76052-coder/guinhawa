import Button from '../Button.jsx';

/** Signs out from inside the profile popover. */
export default function ProfileLogoutButton({ onClick }) {
    return (
        <Button onClick={onClick}>
            <i className="bi bi-box-arrow-right"></i> Logout
        </Button>
    );
}
