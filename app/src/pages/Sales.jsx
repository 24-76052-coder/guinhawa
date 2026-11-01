/**
 * Admin "New Sale" reuses the counter terminal.
 *
 * Both screens must price a product from the same Price A / Price B variants,
 * check the same per-unit stock and call the same store.checkout(), so there is
 * exactly one implementation to keep correct.
 */

export { default } from './Pos.jsx';
