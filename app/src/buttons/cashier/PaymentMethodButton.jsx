import Button from '../Button.jsx';

/** One of the three payment tiles in the counter payment panel. */
export default function PaymentMethodButton({ icon, method, active, onClick }) {
    return (
        <Button variant={active ? 'is-on' : ''} aria-pressed={active} onClick={onClick}>
            <i className={`bi ${icon}`}></i>
            {method}
        </Button>
    );
}
