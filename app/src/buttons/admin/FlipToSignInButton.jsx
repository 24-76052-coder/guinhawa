import Button from '../Button.jsx';

/** Flip the auth card from the sign-up face back to the login face. */
export default function FlipToSignInButton({ onClick }) {
    return (
        <Button variant="gp-swap-btn" onClick={onClick}>
            Sign in
        </Button>
    );
}
