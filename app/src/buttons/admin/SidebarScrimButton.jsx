import Button from '../Button.jsx';

/** Dimmed backdrop behind the mobile sidebar drawer. */
export default function SidebarScrimButton({ visible, onClick }) {
    return (
        <Button
            variant={`admin-scrim${visible ? ' visible' : ''}`}
            aria-label="Close navigation"
            onClick={onClick}
        />
    );
}
