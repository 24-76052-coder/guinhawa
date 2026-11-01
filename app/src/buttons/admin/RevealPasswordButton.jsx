import Button from '../Button.jsx';

/** Show / hide the password in the sign-in field. */
export default function RevealPasswordButton({ visible, onClick }) {
    const label = visible ? 'Hide password' : 'Show password';

    return (
        <Button variant="gp-eye" title={label} aria-label={label} onClick={onClick}>
            <i className={`bi ${visible ? 'bi-eye-slash' : 'bi-eye'}`}></i>
        </Button>
    );
}
