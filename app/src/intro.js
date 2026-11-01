/**
 * The splash animation belongs to opening the app, not to ending a session.
 *
 * Layout marks the next sign-in screen as "already introduced" right before it
 * signs out, so the login card can appear straight away instead of replaying
 * the intro. App clears the flag as soon as it lands on any other route, which
 * keeps a normal reload (or a fresh visit) playing the animation as usual.
 */
let skipIntroOnNextLogin = false;

export function skipIntroAfterLogout() {
    skipIntroOnNextLogin = true;
}

export function shouldSkipIntro() {
    return skipIntroOnNextLogin;
}

export function clearIntroSkip() {
    skipIntroOnNextLogin = false;
}
