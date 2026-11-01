import { useEffect, useMemo, useState } from 'react';
import logoSrc from '../assets/logo.png';
import featherSrc from '../assets/feather-only-hd.png';
import '../styles/IntroAnimation.css';

/** How long the splash holds before handing over to the sign-in card. */
const INTRO_DURATION = 5000;
/** On browsers without View Transitions, the splash fades itself out first. */
const EXIT_LEAD = 450;

const FEATHERS = [
    { className: 'intro-feather--one', size: 138, delay: '0.1s', duration: '4.8s' },
    { className: 'intro-feather--two', size: 78, delay: '0.5s', duration: '4.4s' },
    { className: 'intro-feather--three', size: 112, delay: '0.8s', duration: '5.0s' },
    { className: 'intro-feather--four', size: 64, delay: '1.2s', duration: '4.2s' },
    { className: 'intro-feather--five', size: 96, delay: '1.6s', duration: '4.6s' },
    { className: 'intro-feather--six', size: 58, delay: '2.0s', duration: '4.0s' },
    { className: 'intro-feather--seven', size: 126, delay: '2.4s', duration: '4.8s' },
    { className: 'intro-feather--eight', size: 72, delay: '2.8s', duration: '4.4s' },
    { className: 'intro-feather--nine', size: 104, delay: '0.4s', duration: '5.2s' },
    { className: 'intro-feather--ten', size: 54, delay: '1.8s', duration: '4.1s' },
    { className: 'intro-feather--eleven', size: 84, delay: '2.2s', duration: '4.7s' },
    { className: 'intro-feather--twelve', size: 118, delay: '1.2s', duration: '5.4s' },
];

function Feather({ className, size, delay, duration }) {
    return (
        <div
            className={`intro-feather ${className}`}
            style={{ '--feather-size': `${size}px`, '--feather-delay': delay, '--feather-duration': duration }}
            aria-hidden="true"
        >
            <img src={featherSrc} alt="" draggable="false" />
        </div>
    );
}

export function IntroAnimation({ onComplete }) {
    const prefersReducedMotion = useMemo(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        [],
    );
    const supportsViewTransition = useMemo(
        () => typeof document.startViewTransition === 'function',
        [],
    );
    const [leaving, setLeaving] = useState(false);

    // Keep the page behind the splash dark so the fallback fade lands on a
    // matching green instead of flashing the white document background.
    useEffect(() => {
        document.documentElement.classList.add('intro-open');
        return () => document.documentElement.classList.remove('intro-open');
    }, []);

    useEffect(() => {
        // When View Transitions are available App morphs the logo into the card
        // and fades the rest of the screen, so any CSS exit here would be
        // captured mid-fade. Everywhere else the splash fades itself out before
        // unmounting, landing on the matching dark page behind it.
        const completeDelay = prefersReducedMotion ? 900 : INTRO_DURATION;
        const timers = [];

        if (!prefersReducedMotion && !supportsViewTransition) {
            timers.push(window.setTimeout(() => setLeaving(true), completeDelay - EXIT_LEAD));
        }
        timers.push(window.setTimeout(onComplete, completeDelay));

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [onComplete, prefersReducedMotion, supportsViewTransition]);

    return (
        <div
            className={`intro-animation${prefersReducedMotion ? ' is-reduced' : ''}${leaving ? ' is-leaving' : ''}`}
            role="presentation"
            aria-label="Guinhawa Poultry Supply introduction"
        >
            <div className="intro-curtain" aria-hidden="true" />
            <div className="intro-vignette" />
            <div className="intro-glow" />
            <div className="intro-light-bloom intro-light-bloom--left" aria-hidden="true" />
            <div className="intro-light-bloom intro-light-bloom--right" aria-hidden="true" />
            {FEATHERS.map((feather, index) => <Feather key={index} {...feather} />)}

            <div className="intro-center">
                <div className="intro-logo-wrap">
                    <img src={logoSrc} alt="Guinhawa Poultry Supply — Healthy Poultry, Better Tomorrow" />
                </div>
            </div>
        </div>
    );
}
