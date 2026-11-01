import Button from '../Button.jsx';

/** The avatar button that opens the profile menu. */
export default function ProfileMenuButton({ session, roleLabel, open, onClick }) {
    return (
        <Button variant="profile-button" aria-expanded={open} onClick={onClick}>
            <span className="admin-avatar">{session?.avatar}</span>
            <span className="profile-name">
                <b>{session?.name || session?.username}</b>
                <small>{roleLabel}</small>
            </span>
            <i className="bi bi-chevron-down"></i>
        </Button>
    );
}
