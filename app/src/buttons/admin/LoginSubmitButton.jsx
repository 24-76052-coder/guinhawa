import Button from '../Button.jsx';

/** The single submit control on the email sign-in card. */
export default function LoginSubmitButton({ disabled }) {
    return (
        <Button type="submit" variant="gp-submit" disabled={disabled}>
            Login <i className="bi bi-arrow-right"></i>
        </Button>
    );
}
