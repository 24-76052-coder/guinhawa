import Button from '../Button.jsx';

/** Activate / deactivate control in the User Management row actions. */
export default function ToggleStaffStatusButton({ active, title, onClick }) {
    return (
        <Button variant="row" title={title} aria-label={title} onClick={onClick}>
            <i className={`bi ${active ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
        </Button>
    );
}
