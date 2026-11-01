import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money, store, useStore, PAYMENT_METHODS, CATEGORIES } from '../store.js';
import {
    canSellVariant,
    preferredVariant,
    totalStock,
    unitShort,
    variantsOf,
} from '../products.js';
import { useSession } from '../auth.js';
import { showError, toast, GREEN } from '../components/dialogs.jsx';
import ProductArt from '../components/ProductArt.jsx';
import AddToCartButton from '../buttons/cashier/AddToCartButton.jsx';
import FilterChipButton from '../buttons/cashier/FilterChipButton.jsx';
import NewOrderButton from '../buttons/cashier/NewOrderButton.jsx';
import PaymentMethodButton from '../buttons/cashier/PaymentMethodButton.jsx';
import RemoveOrderLineButton from '../buttons/cashier/RemoveOrderLineButton.jsx';
import SearchClearButton from '../buttons/cashier/SearchClearButton.jsx';
import ClearCartButton from '../buttons/cashier/ClearCartButton.jsx';
import CompleteSaleButton from '../buttons/cashier/CompleteSaleButton.jsx';
import QtyDecreaseButton from '../buttons/cashier/QtyDecreaseButton.jsx';
import QtyIncreaseButton from '../buttons/cashier/QtyIncreaseButton.jsx';
import logoSrc from '../assets/logo.png';
import Swal from 'sweetalert2';

/** One chip per imported category, so the counter mirrors the master list. */
const FILTERS = [
    { key: 'all', label: 'All', icon: 'bi-grid-3x3-gap-fill', match: () => true },
    ...CATEGORIES.map((category) => ({
        key: category,
        label: category,
        icon: category === 'Feeds' ? 'bi-box-seam'
            : category === 'Medicine' ? 'bi-capsule-pill'
                : category === 'Accessories' ? 'bi-basket'
                    : 'bi-bag-heart',
        match: (product) => product.category === category,
    })),
];

const PAY_OPTIONS = PAYMENT_METHODS;

const PAY_ICONS = { Cash: 'bi-cash-coin', GCash: 'bi-phone' };

function newTransactionId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function lineKey(productId, variantKey) {
    return `${productId}:${variantKey}`;
}

export default function Pos() {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [cart, setCart] = useState([]);
    const [unitChoice, setUnitChoice] = useState({});
    const [discount, setDiscount] = useState(0);
    const [payment, setPayment] = useState('Cash');
    const [tendered, setTendered] = useState('');
    const [lastSale, setLastSale] = useState(null);
    const checkoutLock = useRef(false);
    const transactionId = useRef(newTransactionId());

    const matches = (product) => {
        const keyword = search.trim().toLowerCase();
        if (keyword && ![product.name, product.category, product.subcategory, product.brand, product.barcode, product.sku]
            .some((field) => String(field || '').toLowerCase().includes(keyword))) return false;
        return FILTERS.find((item) => item.key === filter)?.match(product) ?? true;
    };
    const products = state.products.filter(matches);
    const activeFilter = FILTERS.find((item) => item.key === filter) || FILTERS[0];

    /** The unit the cashier picked on a card, else the first one actually sellable. */
    const chosenVariant = (product) => variantsOf(product)
        .find((variant) => variant.key === unitChoice[product.id]) || preferredVariant(product);

    const subtotal = cart.reduce((sum, line) => sum + line.price * line.qty, 0);
    const applied = Math.max(0, Math.min(Number(discount) || 0, subtotal));
    const due = Math.max(0, subtotal - applied);
    // GCash is always settled for the exact total; cash is whatever
    // the cashier keyed in (blank means "exact payment, no change").
    const given = payment === 'Cash' ? Number(tendered) || 0 : due;
    const short = payment === 'Cash' && tendered !== '' && given < due;
    const change = Math.max(0, given - due);
    const quickCashAmounts = useMemo(() => {
        if (!due) return [50, 100, 500, 1000].filter((amount) => amount >= due);
        const candidates = [
            50,
            100,
            500,
            1000,
            Math.ceil(due / 100) * 100,
            Math.ceil(due / 500) * 500,
        ];
        return [...new Set(candidates.filter((amount) => amount > due))]
            .sort((a, b) => a - b)
            .slice(0, 3);
    }, [due]);

    function addToCart(product, override) {
        const variant = override || chosenVariant(product);
        if (!variant) {
            showError(new Error(`${product.name} has no selling unit yet.`));
            return;
        }
        if (Number(variant.stock) <= 0) {
            showError(new Error(`${product.name} has no stock in ${unitShort(variant.unit)} yet. Record a Stock In first.`));
            return;
        }
        if (cart.length === 0) {
            checkoutLock.current = false;
            transactionId.current = newTransactionId();
        }
        const key = lineKey(product.id, variant.key);
        const inCart = cart.find((line) => line.key === key);
        if (inCart) {
            if (inCart.qty >= variant.stock) {
                showError(new Error(`Only ${variant.stock} ${unitShort(variant.unit)} of ${product.name} are available.`));
                return;
            }
            setCart((lines) => lines.map((line) => (line.key === key ? { ...line, qty: line.qty + 1 } : line)));
            return;
        }
        setCart((lines) => [...lines, {
            key,
            id: product.id,
            variant: variant.key,
            name: product.name,
            category: product.category,
            image: product.image,
            price: variant.price,
            stock: variant.stock,
            unit: variant.unit,
            qty: 1,
        }]);
    }

    /** Barcode scanners finish with Enter: a single hit goes straight in. */
    function onSearchKeyDown(event) {
        if (event.key !== 'Enter') return;
        const keyword = search.trim();
        if (!keyword) return;
        const exactBarcode = state.products.find((product) =>
            String(product.barcode || '').toLowerCase() === keyword.toLowerCase()
        );
        const matched = exactBarcode || (products.length === 1 ? products[0] : null);
        if (!matched) return;
        addToCart(matched);
        setSearch('');
    }

    function setQty(key, value) {
        const line = cart.find((item) => item.key === key);
        if (!line) return;
        const quantity = Math.max(1, Math.min(Number(value) || 1, Number(line.stock || 1)));
        setCart((lines) => lines.map((item) => (item.key === key ? { ...item, qty: quantity } : item)));
    }

    function changeQty(key, delta) {
        const line = cart.find((item) => item.key === key);
        if (line) setQty(key, line.qty + delta);
    }

    function removeLine(key) {
        setCart((lines) => lines.filter((line) => line.key !== key));
    }

    function choosePayment(method) {
        setPayment(method);
        // Cash keeps whatever the cashier keyed in; card / GCash settle the total.
        if (method !== 'Cash') setTendered('');
    }

    function resetOrder() {
        setCart([]);
        setDiscount(0);
        setTendered('');
        setPayment('Cash');
        setLastSale(null);
        checkoutLock.current = false;
        transactionId.current = newTransactionId();
    }

    function clearOrder() {
        if (!cart.length && !lastSale) return;
        Swal.fire({
            title: 'Cancel this order?',
            text: 'The current cart will be cleared.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Cancel order',
            cancelButtonText: 'Keep order',
            confirmButtonColor: '#b42318',
            cancelButtonColor: '#718077',
        }).then((result) => {
            if (!result.isConfirmed) return;
            resetOrder();
            toast('Transaction cancelled.');
        });
    }

    async function suspendOrder() {
        if (!cart.length) {
            showError(new Error('Your cart is empty. Add products before suspending an order.'));
            return;
        }
        try {
            const held = await store.holdOrder({
                items: cart,
                discount: applied,
                payment_method: payment,
                amount_tendered: tendered,
                user: session?.username || 'unknown',
            });
            resetOrder();
            toast(`${held.hold_no} suspended. ${held.items.length} item(s) saved.`);
        } catch (error) {
            showError(error);
        }
    }

    function resumeOrder() {
        const heldOrders = state.heldOrders || [];
        if (!heldOrders.length) {
            showError(new Error('There are no suspended orders.'));
            return;
        }
        Swal.fire({
            title: 'Resume suspended order',
            input: 'select',
            inputOptions: Object.fromEntries(heldOrders.map((held) => [
                held.id,
                `${held.hold_no} · ${held.items.length} product(s) · ${held.date}`,
            ])),
            showCancelButton: true,
            confirmButtonText: 'Resume',
            confirmButtonColor: GREEN,
        }).then(async (result) => {
            if (!result.isConfirmed || !result.value) return;
            const held = heldOrders.find((item) => String(item.id) === String(result.value));
            if (!held) return;
            const restored = held.items.map((line) => {
                const variant = line.variant || 'A';
                return {
                    key: line.key || lineKey(line.id, variant),
                    id: line.id,
                    variant,
                    name: line.name,
                    category: line.category,
                    image: line.image,
                    price: Number(line.price),
                    stock: line.stock,
                    unit: line.unit || 'Units',
                    qty: Number(line.qty),
                };
            });
            setCart(restored);
            setDiscount(Number(held.discount) || 0);
            setPayment(held.payment_method || 'Cash');
            setTendered(held.amount_tendered || '');
            try {
                await store.removeHeldOrder(held.id);
            } catch (error) {
                showError(error);
                return;
            }
            checkoutLock.current = false;
            transactionId.current = newTransactionId();
            toast(`${held.hold_no} resumed.`);
        });
    }

    async function completeSale() {
        if (checkoutLock.current) return;
        if (!cart.length) {
            showError(new Error('Your cart is empty. Add at least one product.'));
            return;
        }
        if (payment === 'Cash' && (!tendered || given < due)) {
            showError(new Error(given < due ? 'The amount received is lower than the amount due.' : 'Enter the cash amount received.'));
            return;
        }
        const gcashQrHtml = payment === 'GCash'
            ? state.settings?.gcash_qr
                ? `<div style="margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:7px;">
                       <img src="${state.settings.gcash_qr}" alt="GCash payment QR" style="width:180px;height:180px;object-fit:contain;border-radius:10px;background:#fff;border:1px solid #c9d8cc;padding:6px;" />
                       <b style="color:#176b36;">Scan this QR and confirm payment</b>
                       <span style="font-size:13px;color:#718077;">Amount due: ${money(due)}</span>
                   </div>`
                : `<div style="margin-top:12px;color:#718077;font-size:13px;">No GCash QR uploaded. Add it in Store Settings.</div>`
            : '';
        const confirmation = await Swal.fire({
            title: 'Confirm this transaction?',
            html: `<b>${units} item${units === 1 ? '' : 's'}</b> using <b>${payment}</b><br>Total: <b>${money(due)}</b>${gcashQrHtml}`,
            imageUrl: logoSrc,
            imageWidth: 86,
            imageHeight: 86,
            imageAlt: 'Guinhawa Poultry Supply',
            showCancelButton: true,
            confirmButtonText: 'Confirm sale',
            cancelButtonText: 'Review order',
            confirmButtonColor: GREEN,
            cancelButtonColor: '#718077',
        });
        if (!confirmation.isConfirmed) return;
        checkoutLock.current = true;
        try {
            const sale = await store.checkout({
                items: cart.map((line) => ({
                    product_id: line.id,
                    variant: line.variant,
                    unit: line.unit,
                    quantity: line.qty,
                })),
                customer: 'Walk-in Customer',
                customer_id: '',
                discount: applied,
                payment_method: payment,
                amount_tendered: payment === 'Cash' ? given || due : due,
                user: session?.username || 'unknown',
                user_name: session?.name || session?.username || 'Admin',
                transaction_id: transactionId.current,
            });

            setLastSale(sale);
            setCart([]);
            setDiscount(0);
            setTendered('');
            setPayment('Cash');

            Swal.fire({
                icon: 'success',
                title: 'Sale complete!',
                html: `<p style="margin:0 0 6px;">Receipt <b>${sale.receipt_no}</b> issued for ${money(sale.total)}.</p>
                       <p style="margin:0;font-size:13px;color:#718077;">${payment} &middot; Change due: ${money(sale.change_due)}</p>`,
                showCancelButton: true,
                confirmButtonText: 'View receipt',
                cancelButtonText: 'Done',
                reverseButtons: false,
                confirmButtonColor: GREEN,
                cancelButtonColor: '#718077',
            }).then((result) => {
                if (result.isConfirmed) navigate(`/${session?.role || 'counter-staff'}/receipt/${sale.id}`);
                else toast('Sale recorded. Stock updated.');
            });
        } catch (error) {
            checkoutLock.current = false;
            showError(error);
        }
    }

    const units = cart.reduce((sum, line) => sum + line.qty, 0);

    return (
        <div className="cpos-layout">
            <section className="admin-panel cpos-products">
                <div className="panel-heading cpos-products-head">
                    <div className="cpos-title">
                        <span className="admin-kicker">GUINHAWA COUNTER</span>
                        <h1>Products</h1>
                        <p>
                            {products.length} of {state.products.length} items
                            {filter !== 'all' ? ` · ${activeFilter.label}` : ''}
                        </p>
                    </div>

                    <div className="cpos-search-wrap">
                        <div className="cpos-search-box">
                            <label className="admin-search cpos-search">
                                <i className="bi bi-search"></i>
                                <input
                                    type="text"
                                    placeholder="Search name, brand, category or barcode..."
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    onKeyDown={onSearchKeyDown}
                                />
                            </label>
                            {search ? (
                                <SearchClearButton onClick={() => setSearch('')} />
                            ) : (
                                <span className="cpos-scan" aria-hidden="true"><i className="bi bi-upc"></i></span>
                            )}
                        </div>
                        <small className="cpos-hint">
                            <i className="bi bi-keyboard"></i> Scan a barcode or type a name, then press <b>Enter</b> when one product matches.
                        </small>
                    </div>
                </div>

                <div className="cpos-chips">
                    {FILTERS.map((item) => {
                        const count = state.products.filter(item.match).length;
                        return (
                            <FilterChipButton
                                key={item.key}
                                icon={item.icon}
                                label={item.label}
                                count={count}
                                active={filter === item.key}
                                onClick={() => setFilter(item.key)}
                            />
                        );
                    })}
                </div>

                <div className="cpos-grid">
                    {products.length === 0 ? (
                        <div className="cpos-empty">
                            <i className="bi bi-search"></i>
                            <b>No product matches your search.</b>
                            <span>Try another keyword or pick a different category.</span>
                        </div>
                    ) : products.map((product) => {
                        const variants = variantsOf(product);
                        const chosen = chosenVariant(product);
                        const soldOut = totalStock(product) <= 0;
                        const awaiting = soldOut && product.awaiting_stock;
                        const inCart = cart.find((line) => line.id === product.id);
                        const remaining = chosen ? Number(chosen.stock) - (inCart ? inCart.qty : 0) : 0;
                        const low = remaining > 0 && chosen && remaining <= Number(chosen.minimum || 0);
                        const canAdd = chosen && canSellVariant(chosen);
                        return (
                            <article
                                className={`cpos-card${canAdd ? '' : ' is-out'}`}
                                key={product.id}
                                role={canAdd ? 'button' : undefined}
                                tabIndex={canAdd ? 0 : -1}
                                aria-label={canAdd ? `Add ${product.name} (${chosen.unit}) to cart` : `${product.name}, not available`}
                                onClick={(event) => {
                                    if (!event.target.closest('button') && canAdd) addToCart(product);
                                }}
                                onKeyDown={(event) => {
                                    if (!event.target.closest('button') && canAdd && (event.key === 'Enter' || event.key === ' ')) {
                                        event.preventDefault();
                                        addToCart(product);
                                    }
                                }}
                            >
                                <ProductArt product={product} className="cpos-thumb" />
                                <b className="cpos-card-name">{product.name}</b>
                                <small className="cpos-card-meta">
                                    {product.category} &middot; {product.subcategory || product.brand || 'General'}
                                </small>

                                {variants.length > 1 ? (
                                    <div className="cpos-variants" role="group" aria-label={`Selling units for ${product.name}`}>
                                        {variants.map((variant) => {
                                            return (
                                                <button
                                                    type="button"
                                                    key={variant.key}
                                                    className={`cpos-variant${chosen?.key === variant.key ? ' is-on' : ''}`}
                                                    title={`${money(variant.price)} per ${variant.unit}`}
                                                    onClick={() => setUnitChoice((choice) => ({ ...choice, [product.id]: variant.key }))}
                                                >
                                                    <span>{unitShort(variant.unit)}</span>
                                                    <b>{money(variant.price)}</b>
                                                    <small>{variant.stock} left</small>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <small className="cpos-card-unit">
                                        {chosen ? `${money(chosen.price)} / ${unitShort(chosen.unit)}` : 'No selling unit'}
                                    </small>
                                )}

                                <div className="cpos-card-foot">
                                    <b className="cpos-price">{chosen ? money(chosen.price) : '—'}</b>
                                    <span className={`cpos-left${low ? ' is-low' : ''}`}>
                                        <i className={`bi ${awaiting ? 'bi-hourglass-split' : soldOut ? 'bi-x-circle' : low ? 'bi-exclamation-circle' : 'bi-check2-circle'}`}></i>
                                        {awaiting
                                            ? 'Awaiting stock'
                                            : soldOut
                                                ? 'Out of Stock'
                                                : low
                                                    ? `Low Stock \u00b7 ${remaining} left`
                                                    : `In Stock \u00b7 ${remaining} left`}
                                    </span>
                                </div>
                                <AddToCartButton
                                    disabled={!canAdd || remaining <= 0}
                                    inCartQty={inCart ? inCart.qty : 0}
                                    onClick={() => addToCart(product)}
                                />
                            </article>
                        );
                    })}
                </div>
            </section>

            <aside className="admin-panel cpos-order">
                <div className="panel-heading">
                    <div>
                        <span className="admin-kicker">CURRENT ORDER</span>
                        <h2>{cart.length === 0 ? 'Cart is empty' : `${units} item${units === 1 ? '' : 's'}`}</h2>
                        <p>{cart.length === 0 ? 'No products added yet' : `${cart.length} product${cart.length === 1 ? '' : 's'} on the counter`}</p>
                    </div>
                    <div className="cpos-order-actions">
                        <button type="button" className="admin-soft" onClick={suspendOrder} disabled={cart.length === 0}>
                            <i className="bi bi-pause-circle"></i> Hold
                        </button>
                        <button type="button" className="admin-soft" onClick={resumeOrder} disabled={(state.heldOrders || []).length === 0}>
                            <i className="bi bi-arrow-counterclockwise"></i> Resume
                        </button>
                        <ClearCartButton onClick={clearOrder} disabled={cart.length === 0 && !lastSale} />
                    </div>
                </div>

                <div className="cpos-lines">
                    {cart.length === 0 ? (
                        <div className="cpos-empty cpos-empty-inline">
                            <i className="bi bi-cart3"></i>
                            <span>
                                <b>Start an order</b>
                                Pick a product from the grid or scan a barcode.
                            </span>
                        </div>
                    ) : cart.map((line) => (
                        <div className="cpos-line" key={line.key}>
                            <ProductArt product={line} className="cpos-line-thumb" />
                            <span className="cpos-line-info">
                                <b>{line.name}</b>
                                <small>{money(line.price)} / {unitShort(line.unit)} &middot; {line.stock} {unitShort(line.unit)} left</small>
                            </span>
                            <span className="cpos-line-qty">
                                <QtyDecreaseButton name={line.name} onClick={() => changeQty(line.key, -1)} />
                                <input
                                    type="number"
                                    min="1"
                                    max={line.stock}
                                    value={line.qty}
                                    aria-label={`Quantity of ${line.name}`}
                                    onChange={(event) => setQty(line.key, event.target.value)}
                                />
                                <QtyIncreaseButton name={line.name} onClick={() => changeQty(line.key, 1)} />
                            </span>
                            <b className="cpos-line-total">{money(line.price * line.qty)}</b>
                            <RemoveOrderLineButton name={line.name} onClick={() => removeLine(line.key)} />
                        </div>
                    ))}
                </div>

                <div className="cpos-pay">
                    <div className="cpos-summary">
                        <div className="cpos-summary-row">
                            <span>Subtotal</span>
                            <b>{money(subtotal)}</b>
                        </div>
                        <label className="cpos-summary-row cpos-discount-row">
                            <span>Discount</span>
                            <span className="cpos-inline-money">
                                <i className="bi bi-cash-stack"></i>
                                <input
                                    type="number"
                                    className="admin-input"
                                    min="0"
                                    step="0.01"
                                    value={discount}
                                    onChange={(event) => setDiscount(event.target.value)}
                                    aria-label="Discount amount"
                                />
                            </span>
                        </label>
                        <div className="cpos-summary-row cpos-summary-total">
                            <span>Total</span>
                            <b>{money(due)}</b>
                        </div>
                    </div>

                    <div className="cpos-pay-block">
                        <span className="cpos-block-title">Payment method</span>
                        <div className="cpos-methods">
                            {PAY_OPTIONS.map((method) => (
                                <PaymentMethodButton
                                    key={method}
                                    icon={PAY_ICONS[method]}
                                    method={method}
                                    active={payment === method}
                                    onClick={() => choosePayment(method)}
                                />
                            ))}
                        </div>
                    </div>

                    {payment === 'GCash' ? (
                        <div className="cpos-gcash-qr">
                            {state.settings?.gcash_qr ? (
                                <>
                                    <img src={state.settings.gcash_qr} alt="GCash payment QR code" />
                                    <div>
                                        <b>Scan to pay with GCash</b>
                                        <span>Amount due: {money(due)}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="cpos-gcash-empty">
                                    <i className="bi bi-qr-code-scan"></i>
                                    <span>No GCash QR uploaded yet. Add it in Settings.</span>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <label className="pos-field">
                        <span>Amount received{payment !== 'Cash' ? ` (${payment})` : ''}</span>
                        <span className="cpos-money">
                            <i className="bi bi-cash-coin"></i>
                            <input
                                type="number"
                                className="admin-input cpos-tendered"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={payment === 'Cash' ? tendered : due.toFixed(2)}
                                readOnly={payment !== 'Cash'}
                                placeholder={due.toFixed(2)}
                                onChange={(event) => setTendered(event.target.value)}
                                onFocus={(event) => {
                                    if (payment === 'Cash') event.currentTarget.select();
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && cart.length && payment === 'Cash' && !short && tendered) {
                                        event.preventDefault();
                                        completeSale();
                                    }
                                }}
                            />
                        </span>
                    </label>
                    {payment === 'Cash' && (
                        <div className="cpos-quick-cash" aria-label="Quick cash amounts">
                            {quickCashAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    className={Number(tendered) === amount ? 'is-on' : ''}
                                    onClick={() => setTendered(String(amount))}
                                >
                                    {money(amount)}
                                </button>
                            ))}
                            <button
                                type="button"
                                className={tendered !== '' && Number(tendered) === Number(due.toFixed(2)) ? 'is-on' : ''}
                                onClick={() => setTendered(due.toFixed(2))}
                            >
                                Exact
                            </button>
                        </div>
                    )}

                    <div className={`pos-total-row pos-change-row${short ? ' is-short' : ''}`}>
                        <span><i className={`bi ${short ? 'bi-exclamation-circle' : 'bi-arrow-left-right'}`}></i> {short ? 'Still due' : 'Change'}</span>
                        <b>{money(short ? due - given : change)}</b>
                    </div>

                    <CompleteSaleButton
                        onClick={completeSale}
                        disabled={cart.length === 0 || (payment === 'Cash' && (!tendered || short))}
                    />

                    {lastSale ? (
                        <div className="cpos-receipt">
                            <span>
                                <i className="bi bi-check2-circle"></i>
                                <b>{lastSale.receipt_no}</b> issued for {money(lastSale.total)}
                            </span>
                            <div className="cpos-receipt-actions">
                                <Link to={`/${session?.role || 'counter-staff'}/receipt/${lastSale.id}`}>
                                    <i className="bi bi-receipt"></i> View receipt
                                </Link>
                                <NewOrderButton onClick={clearOrder} />
                            </div>
                        </div>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}
