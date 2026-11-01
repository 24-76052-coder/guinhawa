import Button from '../Button.jsx';

/** Closes the sidebar drawer from inside the brand row. */
export default function SidebarCloseButton({ onClick }) {
    return (
        <Button variant="sidebar-close" aria-label="Close navigation" onClick={onClick}>
            <i className="bi bi-x-lg"></i>
        </Button>
    );
}
