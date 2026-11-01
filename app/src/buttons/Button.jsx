/**
 * The single primitive every button in the app is built from.
 *
 * - `type` defaults to "button", so a control can never submit a form by
 *   accident. Submit buttons opt in with `type="submit"`.
 * - `variant` maps to the visual families already used by the CSS. Values are
 *   space separated ("row danger") and unknown tokens pass through as plain
 *   class names, so component files never have to hand assemble class strings.
 * - `disabled` is forwarded verbatim: the browser blocks the click and the
 *   shared `:disabled` rules dim the control.
 */
const VARIANT_CLASS = {
    primary: 'admin-primary',
    soft: 'admin-soft',
    danger: 'danger',
    mini: 'mini-action',
    icon: 'table-icon',
    row: '',
};

export default function Button({ variant = '', type = 'button', className = '', ...rest }) {
    const variantClass = String(variant)
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => VARIANT_CLASS[token] ?? token)
        .join(' ');
    const cls = [variantClass, className].filter(Boolean).join(' ');

    return <button type={type} className={cls || undefined} {...rest} />;
}
