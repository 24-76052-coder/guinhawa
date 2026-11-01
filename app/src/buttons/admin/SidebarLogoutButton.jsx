import Button from '../Button.jsx';

/** Ends the session from the bottom of the sidebar. */
export default function SidebarLogoutButton({ onClick }) {
    return (
        <Button variant="sidebar-logout" onClick={onClick}>
            <i className="bi bi-box-arrow-right"></i> Log Out
        </Button>
    );
}
