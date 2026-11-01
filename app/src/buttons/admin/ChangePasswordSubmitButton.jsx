import Button from '../Button.jsx';

/** Submit control on the first-login password change screen. */
export default function ChangePasswordSubmitButton({ disabled }) {
    return (
        <Button type="submit" variant="gp-submit" disabled={disabled}>
            Save password <i className="bi bi-shield-check"></i>
        </Button>
    );
}
