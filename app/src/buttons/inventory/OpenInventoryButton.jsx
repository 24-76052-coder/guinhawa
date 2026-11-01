import Button from '../Button.jsx';

/** Panel-heading shortcut from the restock list to the inventory table. */
export default function OpenInventoryButton({ onClick }) {
    return (
        <Button variant="soft" onClick={onClick}>
            <i className="bi bi-clipboard-data"></i> Open inventory
        </Button>
    );
}
