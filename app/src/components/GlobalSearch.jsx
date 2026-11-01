import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth.js';
import { useStore } from '../store.js';
import { stockSummary } from '../products.js';

function matches(values, keyword) {
    return values.some((value) => String(value || '').toLowerCase().includes(keyword));
}

/** Global search for the topbar: pages, products and orders. */
export default function GlobalSearch({ pages = [] }) {
    const state = useStore();
    const session = useSession();
    const navigate = useNavigate();
    const role = session?.role || 'admin';
    const isCounter = role === 'counter-staff';
    const isInventory = role === 'inventory-staff';
    const productPath = isCounter ? '/available-stocks' : isInventory ? '/products' : '/products';

    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const wrapRef = useRef(null);

    const keyword = query.trim().toLowerCase();

    const results = useMemo(() => {
        if (!keyword) return [];
        const found = [];

        pages
            .filter((page) => page.label.toLowerCase().includes(keyword))
            .slice(0, 3)
            .forEach((page) => {
                found.push({
                    key: `page-${page.path}`,
                    icon: page.icon,
                    title: page.label,
                    meta: 'Page',
                    to: `/${role}${page.path}`,
                });
            });

        state.products
            .filter((product) => matches([product.name, product.category, product.subcategory, product.brand, product.supplier, product.barcode, product.sku], keyword))
            .slice(0, 4)
            .forEach((product) => {
                found.push({
                    key: `product-${product.id}`,
                    icon: 'bi-box-seam',
                    title: product.name,
                    meta: `${product.category} · ${stockSummary(product)} in stock`,
                    to: `/${role}${productPath}?q=${encodeURIComponent(product.name)}`,
                });
            });

        if (role === 'admin') {
            state.orders
                .filter((order) => matches([order.id, order.customer, order.product], keyword))
                .slice(0, 3)
                .forEach((order) => {
                    found.push({
                        key: `order-${order.id}`,
                        icon: 'bi-cart-check',
                        title: `Order #${order.id}`,
                        meta: `${order.customer} · ${order.status}`,
                        to: `/${role}/orders?q=${encodeURIComponent(order.id)}`,
                    });
                });
        }

        return found.slice(0, 9);
    }, [keyword, pages, role, isCounter, productPath, state.orders, state.products]);

    useEffect(() => {
        function closeOnOutsideClick(event) {
            if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
        }

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    function choose(result) {
        setQuery('');
        setOpen(false);
        navigate(result.to);
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            setOpen(false);
            return;
        }
        if (!results.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % results.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index - 1 + results.length) % results.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(results[active] || results[0]);
        }
    }

    return (
        <div className="topbar-search" ref={wrapRef}>
            <div className="admin-search">
                <i className="bi bi-search"></i>
                <input
                    type="search"
                    value={query}
                    placeholder={role === 'admin' ? 'Search products, orders...' : 'Search products and pages...'}
                    aria-label={`Search the ${role === 'admin' ? 'admin' : isInventory ? 'inventory' : 'cashier'} workspace`}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        if (query.trim()) setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {query ? (
                    <button
                        type="button"
                        className="topbar-search-clear"
                        aria-label="Clear search"
                        onClick={() => {
                            setQuery('');
                            setOpen(false);
                        }}
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                ) : null}
            </div>

            {open && keyword ? (
                <div className="topbar-search-results" role="listbox">
                    {results.length ? (
                        results.map((result, index) => (
                            <button
                                key={result.key}
                                type="button"
                                role="option"
                                aria-selected={index === active}
                                className={index === active ? 'active' : ''}
                                onMouseEnter={() => setActive(index)}
                                onClick={() => choose(result)}
                            >
                                <span className="topbar-search-icon"><i className={`bi ${result.icon}`}></i></span>
                                <span className="topbar-search-copy">
                                    <b>{result.title}</b>
                                    <small>{result.meta}</small>
                                </span>
                                <i className="bi bi-arrow-return-left topbar-search-enter"></i>
                            </button>
                        ))
                    ) : (
                        <p className="topbar-search-empty">No results for &ldquo;{query.trim()}&rdquo;.</p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
