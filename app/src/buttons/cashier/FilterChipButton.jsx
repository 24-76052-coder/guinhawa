import Button from '../Button.jsx';

/** Category chip above the counter product grid. */
export default function FilterChipButton({ icon, label, count, active, onClick }) {
    return (
        <Button variant={`cpos-chip${active ? ' is-on' : ''}`} aria-pressed={active} onClick={onClick}>
            <i className={`bi ${icon}`}></i>
            {label}
            <span>{count}</span>
        </Button>
    );
}
