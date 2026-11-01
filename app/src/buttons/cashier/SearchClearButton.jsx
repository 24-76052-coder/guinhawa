import Button from '../Button.jsx';

/** Clears the counter search box. */
export default function SearchClearButton({ onClick }) {
    return (
        <Button variant="cpos-search-clear" aria-label="Clear search" onClick={onClick}>
            <i className="bi bi-x-lg"></i>
        </Button>
    );
}
