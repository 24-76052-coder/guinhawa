import { useNavigate } from 'react-router-dom';
import Button from '../Button.jsx';

/**
 * Back out of a printable receipt: staff land on the sales history, the admin
 * lands on the dashboard. The label follows the role so the button never has
 * to be special-cased in the page.
 */
export default function ReceiptBackButton({ role, to }) {
    const navigate = useNavigate();
    const isStaff = role === 'staff' || role === 'counter-staff' || role === 'inventory-staff';

    return (
        <Button variant="soft" onClick={() => navigate(to)}>
            <i className={`bi ${isStaff ? 'bi-upc-scan' : 'bi-speedometer2'}`}></i>
            {isStaff ? 'POS' : 'Dashboard'}
        </Button>
    );
}
