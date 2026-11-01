import Button from '../Button.jsx';

/** Small text button used to abandon a forced password change. */
export default function ChangePasswordLogoutButton({ onClick }) {
    return (
        <Button variant="gp-swap-btn" onClick={onClick}>
            Sign out instead
        </Button>
    );
}
