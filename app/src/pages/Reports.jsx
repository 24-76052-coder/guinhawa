import { useMemo, useState } from 'react';
import { recentDays, recordFor } from '../attendance.js';
import { useStaffRoster } from '../auth.js';
import { isoDate, money, toISODate, useStore } from '../store.js';
import { stockState, totalStock, unitShort, variantsOf } from '../products.js';
import { toast } from '../components/dialogs.jsx';
import { EmptyState, PageHead } from '../components/ui.jsx';

const REPORTS = [
    'Sales', 'Inventory', 'Stock In', 'Stock Out', 'Low Stock', 'Expiration',
    'Damaged Products', 'Staff Attendance',
];

function escapeCsv(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function Reports() {
    const state = useStore();
    const roster = useStaffRoster();
    const [report, setReport] = useState('Sales');
    const [period, setPeriod] = useState('monthly');

    const periodMatch = (value) => {
        const date = toISODate(value) || '';
        if (!date) return false;
        if (period === 'daily') return date === isoDate();
        if (period === 'weekly') {
            const ago = new Date();
            ago.setDate(ago.getDate() - 7);
            return date >= isoDate(ago) && date <= isoDate();
        }
        if (period === 'monthly') return date.slice(0, 7) === isoDate().slice(0, 7);
        return date.slice(0, 4) === isoDate().slice(0, 4);
    };

    const rows = useMemo(() => {
        if (report === 'Sales') {
            return state.sales.filter((sale) => periodMatch(sale.date) || periodMatch(sale.created_at))
                .map((sale) => [sale.receipt_no, sale.date, sale.customer, sale.cashier, sale.payment_method, sale.total, sale.status]);
        }
        if (report === 'Inventory') return state.products.map((product) => [
            product.sku || '—',
            product.barcode || '—',
            product.name,
            product.category,
            product.subcategory || '—',
            variantsOf(product).map((variant) => `${variant.unit}: ${money(variant.price)}`).join(' | '),
            variantsOf(product).map((variant) => `${variant.stock} ${unitShort(variant.unit)}`).join(' | '),
            product.minimum,
            stockState(product),
        ]);
        if (report === 'Stock In') return state.stockMoves.filter((move) => move.action === 'Stock In' && periodMatch(move.date)).map((move) => [move.reference, move.date, move.time || '', move.product, move.quantity, move.unit || 'Units', move.user, move.remarks]);
        if (report === 'Stock Out') return state.stockMoves.filter((move) => move.action === 'Stock Out' && periodMatch(move.date)).map((move) => [move.reference, move.date, move.time || '', move.product, move.quantity, move.unit || 'Units', move.user, move.remarks]);
        if (report === 'Low Stock') return state.products
            .filter((product) => stockState(product) !== 'In Stock' && !(product.awaiting_stock && totalStock(product) <= 0))
            .map((product) => [
                product.sku || '—',
                product.name,
                product.category,
                variantsOf(product).map((variant) => `${variant.stock} ${unitShort(variant.unit)}`).join(' | '),
                product.minimum,
                unitShort(product.unit),
                stockState(product),
            ]);
        if (report === 'Expiration') return state.products.filter((product) => product.expiration_date).map((product) => [
            product.name,
            product.category,
            product.expiration_date,
            variantsOf(product).map((variant) => `${variant.stock} ${unitShort(variant.unit)}`).join(' | '),
        ]);
        if (report === 'Damaged Products') return (state.inventoryIssues || []).filter((issue) => periodMatch(issue.date)).map((issue) => [issue.reference, issue.date, issue.product, issue.quantity, issue.unit || 'Units', issue.reason, issue.staff_id, issue.remarks]);
        return recentDays(7).flatMap((day) => roster.map((staff) => {
            const record = recordFor(staff.code, day);
            return [day, staff.code, staff.name, record?.in || '', record?.out || '', record?.hours || 0, record ? 'Present' : 'Absent'];
        }));
    }, [report, period, state, roster]);

    const headers = {
        Sales: ['Receipt', 'Date', 'Customer', 'Cashier', 'Payment', 'Total', 'Status'],
        Inventory: ['SKU', 'Barcode', 'Product', 'Category', 'Subcategory', 'Selling Units & Prices', 'Available Stock', 'Minimum', 'Status'],
        'Stock In': ['Reference', 'Date', 'Time', 'Product', 'Quantity', 'Unit', 'User', 'Remarks'],
        'Stock Out': ['Reference', 'Date', 'Time', 'Product', 'Quantity', 'Unit', 'User', 'Remarks'],
        'Low Stock': ['SKU', 'Product', 'Category', 'Available Stock', 'Minimum', 'Unit', 'Status'],
        Expiration: ['Product', 'Category', 'Expiration Date', 'Available Stock'],
        'Damaged Products': ['Reference', 'Date', 'Product', 'Quantity', 'Unit', 'Reason', 'Staff', 'Remarks'],
        'Staff Attendance': ['Date', 'Staff ID', 'Name', 'Clock In', 'Clock Out', 'Hours', 'Status'],
    };

    function exportCsv() {
        const csv = [headers[report], ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `guinhawa-${report.toLowerCase().replaceAll(' ', '-')}-${period}-${isoDate()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast('Excel-compatible report downloaded.');
    }

    function exportPdf() {
        const htmlRows = rows.map((row) => `<tr>${row.map((value) => `<td>${String(value ?? '').replace(/[<>&]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char])}</td>`).join('')}</tr>`).join('');
        const win = window.open('', '_blank', 'width=1000,height=700');
        win.document.write(`<html><head><title>Guinhawa ${report} Report</title><style>body{font-family:Arial,sans-serif;color:#173d25;padding:24px}h1{font-size:22px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5ce;padding:7px;text-align:left}th{background:#eaf4ed}@media print{button{display:none}}</style></head><body><h1>Guinhawa Poultry Supply - ${report} Report</h1><p>${period[0].toUpperCase()+period.slice(1)} report · ${isoDate()}</p><table><thead><tr>${headers[report].map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table><button onclick="window.print()">Print / Save PDF</button></body></html>`);
        win.document.close();
    }

    return (
        <>
            <PageHead title="Reports" subtitle="Generate sales, inventory, movement, damaged stock, and attendance reports." actions={
                <div className="page-actions">
                    <button className="admin-soft" type="button" onClick={exportPdf}><i className="bi bi-file-earmark-pdf"></i> Export PDF</button>
                    <button className="admin-primary" type="button" onClick={exportCsv}><i className="bi bi-file-earmark-excel"></i> Export Excel</button>
                </div>
            } />
            <div className="admin-toolbar">
                <select className="admin-select" value={report} onChange={(event) => setReport(event.target.value)}>
                    {REPORTS.map((name) => <option key={name}>{name}</option>)}
                </select>
                {report === 'Sales' ? (
                    <select className="admin-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
                        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                    </select>
                ) : (
                    <select className="admin-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
                        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                    </select>
                )}
            </div>
            <div className="admin-panel">
                <div className="panel-heading"><div><h2>{report} Report</h2><p>{rows.length} record{rows.length === 1 ? '' : 's'}</p></div></div>
                <div className="table-wrap">
                    <table>
                        <thead><tr>{headers[report].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                        <tbody>
                            {rows.length === 0 ? <tr><td colSpan={headers[report].length}><EmptyState icon="bi-file-earmark-bar-chart" title="No report records" body="There are no matching records for this report period." /></td></tr> :
                                rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
