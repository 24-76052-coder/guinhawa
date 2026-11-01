import { useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth.js';
import logoSrc from '../assets/logo.png';

export const ADMIN_WELCOME_KEY = 'guinhawa-admin-welcome';

const WELCOME_SOUND_SRC = `${import.meta.env.BASE_URL}sounds/welcome.mp3?v=7`;
const WELCOME_SOUND_VOLUME = 0.4;

let welcomeVoice = null;
let cancelWelcomeVoiceUnlock = () => {};

export function warmWelcomeVoice() {
    if (welcomeVoice) return;
    const audio = new Audio(WELCOME_SOUND_SRC);
    audio.preload = 'auto';
    audio.volume = 0;
    welcomeVoice = audio;
    const playback = audio.play();
    if (playback && typeof playback.then === 'function') {
        playback.then(() => {
            audio.pause();
            audio.currentTime = 0;
        }).catch(() => {
            if (welcomeVoice === audio) welcomeVoice = null;
        });
    }
}

function playWelcomeVoice() {
    const audio = welcomeVoice || new Audio(WELCOME_SOUND_SRC);
    audio.preload = 'auto';
    audio.volume = WELCOME_SOUND_VOLUME;
    audio.currentTime = 0;
    audio.loop = false;
    welcomeVoice = audio;

    let started = false;
    let removeUnlock = () => {};

    const forget = () => {
        if (welcomeVoice === audio) welcomeVoice = null;
        removeUnlock();
    };

    const start = () => {
        removeUnlock();
        const playback = audio.play();
        if (!playback || typeof playback.then !== 'function') {
            started = true;
            return;
        }
        playback.then(() => {
            started = true;
        }).catch((error) => {
            if (welcomeVoice !== audio) return;
            if (error?.name === 'NotAllowedError') {
                listenForGesture();
            } else {
                welcomeVoice = null;
            }
        });
    };

    const listenForGesture = () => {
        removeUnlock();
        const unlock = () => {
            removeUnlock();
            start();
        };
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        removeUnlock = () => {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            removeUnlock = () => {};
        };
    };

    cancelWelcomeVoiceUnlock = () => {
        removeUnlock();
        cancelWelcomeVoiceUnlock = () => {};
        if (welcomeVoice !== audio || started || (!audio.paused && audio.currentTime > 0)) return;
        audio.pause();
        welcomeVoice = null;
    };

    audio.addEventListener('ended', forget, { once: true });
    start();
}

function greetingFor(hour) {
    if (hour >= 5 && hour < 12) return 'GOOD MORNING';
    if (hour >= 12 && hour < 18) return 'GOOD AFTERNOON';
    if (hour >= 18 && hour < 22) return 'GOOD EVENING';
    return 'GOOD NIGHT';
}

/**
 * Full-screen intro shown once, right after an admin signs in. It fades away
 * by itself and reveals the dashboard underneath; the flag is cleared when
 * the animation is done so a refresh or a later visit skips the intro.
 */
export default function AdminWelcome() {
    const session = useSession();
    const [visible, setVisible] = useState(() => {
        if (session?.role !== 'admin') return false;
        try {
            return sessionStorage.getItem(ADMIN_WELCOME_KEY) === '1';
        } catch {
            return false;
        }
    });
    const [closing, setClosing] = useState(false);
    const [now] = useState(() => new Date());

    const greeting = useMemo(() => greetingFor(now.getHours()), [now]);
    const dateLabel = useMemo(
        () => now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }),
        [now],
    );

    useEffect(() => {
        if (!visible) return undefined;

        const closeTimer = setTimeout(() => setClosing(true), 3500);
        const doneTimer = setTimeout(() => {
            cancelWelcomeVoiceUnlock();
            try {
                sessionStorage.removeItem(ADMIN_WELCOME_KEY);
            } catch {
                /* storage disabled */
            }
            setVisible(false);
        }, 4250);

        return () => {
            clearTimeout(closeTimer);
            clearTimeout(doneTimer);
        };
    }, [visible]);

    useEffect(() => {
        if (!visible) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [visible]);

    useEffect(() => {
        if (visible) playWelcomeVoice();
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            className={`admin-welcome${closing ? ' is-closing' : ''}`}
            role="status"
            aria-live="polite"
            aria-label={`${greeting}, Admin. ${dateLabel}`}
        >
            <span className="admin-welcome-glow admin-welcome-glow-a" aria-hidden="true"></span>
            <span className="admin-welcome-glow admin-welcome-glow-b" aria-hidden="true"></span>

            <div className="admin-welcome-inner">
                <div className="admin-welcome-logo">
                    <span className="admin-welcome-logo-ring" aria-hidden="true"></span>
                    <img src={logoSrc} alt="Guinhawa Poultry Supply" />
                </div>

                <p className="admin-welcome-kicker">
                    <i className="bi bi-stars" aria-hidden="true"></i>
                    Guinhawa Poultry Supply
                </p>

                <h1 className="admin-welcome-title">
                    {greeting}, <span>ADMIN!</span>
                </h1>

                <p className="admin-welcome-sub">
                    Welcome back, {session?.name || 'Administrator'}. Your dashboard is ready &mdash; let&apos;s make today count.
                </p>

                <p className="admin-welcome-date">
                    <i className="bi bi-calendar3" aria-hidden="true"></i>
                    {dateLabel}
                </p>

                <div className="admin-welcome-loader" aria-hidden="true">
                    <span></span>
                </div>

                <p className="admin-welcome-hint">Preparing your dashboard...</p>
            </div>
        </div>
    );
}
