import Button from '../Button.jsx';

/** Starts today's shift. */
export default function ClockInButton({ onClick }) {
    return (
        <Button variant="primary" onClick={onClick}>
            <i className="bi bi-box-arrow-in-right"></i> Clock in
        </Button>
    );
}
