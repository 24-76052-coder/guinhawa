import Button from '../Button.jsx';

/** Ends today's shift. */
export default function ClockOutButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-box-arrow-right"></i> Clock out
        </Button>
    );
}
