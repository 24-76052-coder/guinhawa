import Button from '../Button.jsx';

/** Status filter on the orders table. The count sits in the pill's span. */
export default function OrderFilterButton({ active, label, count, onClick }) {
    return (
        <Button variant={active ? 'selected' : ''} aria-pressed={active} onClick={onClick}>
            {label} <span>{count}</span>
        </Button>
    );
}
