import Button from '../Button.jsx';

/** Placeholder avatar action on the profile tab. */
export default function ChangePhotoButton({ onClick }) {
    return (
        <Button variant="soft" onClick={onClick}>
            Change photo
        </Button>
    );
}
