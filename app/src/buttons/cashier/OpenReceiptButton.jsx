import Button from '../Button.jsx';

/** Eye icon that opens a receipt from a sales table. */
export default function OpenReceiptButton({ title = 'Open receipt', onClick }) {
    return (
        <Button variant="row" title={title} aria-label={title} onClick={onClick}>
            <i className="bi bi-eye"></i>
        </Button>
    );
}
