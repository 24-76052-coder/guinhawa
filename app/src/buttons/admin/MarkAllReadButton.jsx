import Button from '../Button.jsx';

/** Clears the whole notification feed. Disabled while everything is read. */
export default function MarkAllReadButton({ count = 0, onClick }) {
    return (
        <Button disabled={count === 0} onClick={onClick}>
            Mark all read
        </Button>
    );
}
