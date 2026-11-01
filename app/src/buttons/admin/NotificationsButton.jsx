import Button from '../Button.jsx';

/** The topbar bell. `unread` drives the dot and the accessible name. */
export default function NotificationsButton({ unread = 0, open, onClick }) {
    return (
        <Button
            variant="topbar-icon"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            aria-expanded={open}
            onClick={onClick}
        >
            <i className="bi bi-bell"></i>
            {unread > 0 ? <span className="notification-dot">{unread}</span> : null}
        </Button>
    );
}
