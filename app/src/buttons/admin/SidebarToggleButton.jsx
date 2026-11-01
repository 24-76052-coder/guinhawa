import Button from '../Button.jsx';

/** Hamburger that opens / closes the sidebar drawer on small screens. */
export default function SidebarToggleButton({ open, onClick }) {
    return (
        <Button
            variant="sidebar-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={onClick}
        >
            <i className="bi bi-list"></i>
        </Button>
    );
}
