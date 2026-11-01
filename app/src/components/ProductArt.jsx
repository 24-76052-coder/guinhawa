import { useState } from 'react';
import { CATALOGUE_IMAGE } from '../seed.js';

/**
 * Product pictures for the cashier grid.
 *
 * Every catalogue category gets its own flat illustration, so the POS shows
 * big, distinct artwork that works offline and never 404s. A product carrying
 * its own image URL (set from Products > Edit) is drawn instead, and quietly
 * falls back to the artwork if that URL ever stops loading.
 */

const SHADOW = { fill: '#000', opacity: '.08' };

function ChickenArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="52" cy="87" rx="30" ry="5" {...SHADOW} />
            <path d="M32 52c-9-2-14-9-14-19 8 1 14 6 17 13z" fill="#fff6e6" stroke="#e6c489" strokeWidth="2" strokeLinejoin="round" />
            <ellipse cx="52" cy="61" rx="26" ry="21" fill="#fffaf0" stroke="#e6c489" strokeWidth="2" />
            <path d="M42 57c7-7 18-6 23 2-5 8-16 10-23 5z" fill="#f7e6c6" />
            <path d="M45 81v5M45 86l-6 5M45 86l6 5" stroke="#eda33e" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M61 81v5M61 86l-6 5M61 86l6 5" stroke="#eda33e" strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="72" cy="38" r="14" fill="#fffaf0" stroke="#e6c489" strokeWidth="2" />
            <path d="M64 26c1-5 5-7 7-4 2-5 7-5 8-1 4-3 8 1 6 6z" fill="#e15b4e" />
            <path d="M85 38l10 3-10 4z" fill="#f2a63c" />
            <path d="M77 49c3 3 2 7-2 7-3 0-4-4-1-7z" fill="#e15b4e" />
            <circle cx="76" cy="36" r="3.2" fill="#2c3d2f" />
            <circle cx="77.3" cy="34.9" r="1.1" fill="#fff" />
        </svg>
    );
}

function FeedArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="89" rx="27" ry="5" {...SHADOW} />
            <path d="M30 35h40l6 6v40a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V41z" fill="#f6e7c8" stroke="#d8b475" strokeWidth="2" strokeLinejoin="round" />
            <path d="M30 35l5-11h30l5 11z" fill="#e8cf9d" stroke="#d8b475" strokeWidth="2" strokeLinejoin="round" />
            <path d="M35 24h30" stroke="#c9a76a" strokeWidth="3" strokeLinecap="round" />
            <rect x="34" y="47" width="32" height="26" rx="5" fill="#2f7a45" />
            <path d="M50 52v15M50 56l-5-3M50 56l5-3M50 61l-5-3M50 61l5-3M50 66l-5-3M50 66l5-3" stroke="#ffe6a6" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M30 79h40" stroke="#d8b475" strokeWidth="2" strokeDasharray="3 5" />
        </svg>
    );
}

function MedicineArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="47" cy="89" rx="25" ry="5" {...SHADOW} />
            <rect x="34" y="15" width="27" height="13" rx="4" fill="#5b8def" />
            <rect x="37" y="19" width="21" height="3" fill="#4a7ae0" />
            <rect x="28" y="28" width="39" height="57" rx="10" fill="#f4f8ff" stroke="#a9c4f5" strokeWidth="2" />
            <rect x="34" y="43" width="27" height="28" rx="5" fill="#3b82f6" />
            <path d="M47.5 48v18M38.5 57h18" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <g transform="rotate(-30 76 72)">
                <rect x="61" y="65" width="31" height="15" rx="7.5" fill="#fff" stroke="#a9c4f5" strokeWidth="2" />
                <path d="M76.5 65h7a7.5 7.5 0 0 1 0 15h-7z" fill="#ef6f6c" />
            </g>
        </svg>
    );
}

function RiceArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="89" rx="26" ry="5" {...SHADOW} />
            <path d="M32 37h36l6 6v38a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V43z" fill="#fdf8ea" stroke="#dcc89a" strokeWidth="2" strokeLinejoin="round" />
            <path d="M32 37l4-10h28l4 10z" fill="#f3e7c8" stroke="#dcc89a" strokeWidth="2" strokeLinejoin="round" />
            <rect x="36" y="49" width="28" height="23" rx="5" fill="#8a6a35" />
            <g fill="#fff6e0">
                <ellipse cx="44" cy="56" rx="3.4" ry="2" transform="rotate(-25 44 56)" />
                <ellipse cx="52" cy="54" rx="3.4" ry="2" transform="rotate(15 52 54)" />
                <ellipse cx="57" cy="60" rx="3.4" ry="2" transform="rotate(-10 57 60)" />
                <ellipse cx="46" cy="64" rx="3.4" ry="2" transform="rotate(20 46 64)" />
            </g>
            <path d="M32 79h36" stroke="#dcc89a" strokeWidth="2" strokeDasharray="3 5" />
        </svg>
    );
}

function BowlArt({ variant }) {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="89" rx="30" ry="5" {...SHADOW} />
            <circle cx="39" cy="51" r="7.5" fill="#c98d54" />
            <circle cx="52" cy="46" r="8.5" fill="#dd9d5f" />
            <circle cx="64" cy="52" r="6.5" fill="#c98d54" />
            <circle cx="47" cy="56" r="6.5" fill="#e8ae72" />
            <circle cx="58" cy="58" r="5.5" fill="#c98d54" />
            <path d="M20 57h60l-7 24a8 8 0 0 1-8 6H35a8 8 0 0 1-8-6z" fill="#2f7a45" />
            <path d="M20 57h60l-1.6 7H21.6z" fill="#3d9155" />
            <ellipse cx="50" cy="75" rx="7.5" ry="5.6" fill="#eaf7ec" />
            <circle cx="42.5" cy="68" r="2.7" fill="#eaf7ec" />
            <circle cx="50" cy="66" r="2.7" fill="#eaf7ec" />
            <circle cx="57.5" cy="68" r="2.7" fill="#eaf7ec" />
            {variant === 'dog' ? (
                <path d="M62 27c0-3 2.6-5 5.4-5 1.6 0 3 .7 3.9 1.9.9-1.2 2.3-1.9 3.9-1.9 2.8 0 5.4 2 5.4 5 0 2.1-1.3 3.7-3 4.6v3.1c0 1.4-1.2 2.6-2.6 2.6h-7.4c-1.4 0-2.6-1.2-2.6-2.6v-3.1c-1.7-.9-3-2.5-3-4.6z" fill="#fff3f0" stroke="#e8b4ad" strokeWidth="1.6" />
            ) : (
                <path d="M76 24l14 7-14 7z" fill="#eaf3ff" stroke="#a9c4f5" strokeWidth="1.6" strokeLinejoin="round" />
            )}
        </svg>
    );
}

function DrinkerArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="89" rx="29" ry="5" {...SHADOW} />
            <path d="M50 20c-15 0-26 13-26 28v9h52v-9c0-15-11-28-26-28z" fill="#f4f8ff" stroke="#a9bede" strokeWidth="2" />
            <path d="M34 35c3-6 8-11 14-13" stroke="#dbe6f7" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            <rect x="20" y="55" width="60" height="13" rx="6.5" fill="#e15b4e" />
            <path d="M24 68h52l4 13a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6z" fill="#f4f8ff" stroke="#a9bede" strokeWidth="2" strokeLinejoin="round" />
            <path d="M31 77h38" stroke="#8fb6e6" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
    );
}

function CrateArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="89" rx="28" ry="5" {...SHADOW} />
            <path d="M22 45h56v35a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6z" fill="#e3b57e" stroke="#bd8a52" strokeWidth="2" />
            <path d="M22 45l8-15h40l8 15z" fill="#f2ce9d" stroke="#bd8a52" strokeWidth="2" strokeLinejoin="round" />
            <path d="M50 30v56" stroke="#bd8a52" strokeWidth="2" />
            <path d="M30 57h13M30 69h13M57 57h13M57 69h13" stroke="#bd8a52" strokeWidth="2.6" strokeLinecap="round" opacity=".65" />
        </svg>
    );
}

function TrayArt() {
    return (
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <ellipse cx="50" cy="86" rx="32" ry="5" {...SHADOW} />
            <path d="M16 56h68l-6 22a7 7 0 0 1-7 5H29a7 7 0 0 1-7-5z" fill="#cfd8de" stroke="#9aa8b2" strokeWidth="2" strokeLinejoin="round" />
            <rect x="14" y="50" width="72" height="9" rx="4.5" fill="#e6ecf1" stroke="#9aa8b2" strokeWidth="2" />
            <g fill="#e8b45c">
                <ellipse cx="32" cy="63" rx="4.6" ry="3" />
                <ellipse cx="44" cy="66" rx="4.6" ry="3" />
                <ellipse cx="56" cy="63" rx="4.6" ry="3" />
                <ellipse cx="68" cy="66" rx="4.6" ry="3" />
                <ellipse cx="38" cy="72" rx="4.6" ry="3" />
                <ellipse cx="50" cy="73" rx="4.6" ry="3" />
                <ellipse cx="62" cy="72" rx="4.6" ry="3" />
            </g>
            <path d="M24 83h52" stroke="#9aa8b2" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

const ART = {
    Chickens: { tone: 'amber', Art: ChickenArt },
    Feeds: { tone: 'green', Art: FeedArt },
    Medicine: { tone: 'blue', Art: MedicineArt },
    Rice: { tone: 'sand', Art: RiceArt },
    'Dog Food': { tone: 'rose', Art: () => <BowlArt variant="dog" /> },
    'Cat Food': { tone: 'rose', Art: () => <BowlArt variant="cat" /> },
    Accessories: { tone: 'slate', Art: DrinkerArt },
    Other: { tone: 'slate', Art: CrateArt },
};

/** Feeding trays get their own picture instead of the generic drinker. */
function artFor(product) {
    if (/tray/i.test(product.name || '')) return { tone: 'slate', Art: TrayArt };
    return ART[product.category] || ART.Other;
}

export default function ProductArt({ product, className = 'cpos-thumb' }) {
    const [broken, setBroken] = useState(false);
    const own = product.image && product.image !== CATALOGUE_IMAGE;

    if (own && !broken) {
        return (
            <img
                className={`${className} is-photo`}
                src={product.image}
                alt={product.name}
                loading="lazy"
                onError={() => setBroken(true)}
            />
        );
    }

    const { tone, Art } = artFor(product);
    return (
        <span className={`${className} cpos-tone-${tone}`}>
            <Art />
        </span>
    );
}
