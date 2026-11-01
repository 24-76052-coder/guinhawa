import Button from '../Button.jsx';

/** Small green "View" link used in table action cells for orders. */
export default function ViewOrderButton({ onClick }) {
    return (
        <Button variant="mini" onClick={onClick}>
            View
        </Button>
    );
}
