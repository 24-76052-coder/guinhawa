/**
 * SweetAlert2 dialogs used across the panel. Every call returns a promise, so
 * pages can `await` a confirm before touching the store.
 */

import Swal from 'sweetalert2';

const GREEN = '#166534';

function collectPopupValues(popup) {
    const values = {};
    popup?.querySelectorAll('[name]').forEach((field) => {
        if (!field.name || field.disabled) return;
        if (field.type === 'checkbox') {
            values[field.name] = field.checked ? (field.value || 'on') : '';
        } else if (field.type === 'radio') {
            if (field.checked) values[field.name] = field.value;
        } else {
            values[field.name] = field.value;
        }
    });
    return values;
}

/** Keeps user text from breaking out of a double-quoted HTML attribute. */
function escapeAttr(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function toast(message, icon = 'success') {
    return Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title: message,
        showConfirmButton: false,
        timer: 2400,
        timerProgressBar: true,
    });
}

export function notify(title, text = '', icon = 'info') {
    return Swal.fire({ title, text, icon, confirmButtonColor: GREEN });
}

export function showError(error) {
    return Swal.fire({
        title: 'Something went wrong',
        text: error?.message || String(error),
        icon: 'error',
        confirmButtonColor: GREEN,
    });
}

/** Shows the one-time temporary password returned by the account API. */
export function showTemporaryPassword({ name, employeeId, username, temporaryPassword }) {
    const line = (label, value) => `
        <div style="display:flex;justify-content:space-between;gap:18px;padding:7px 0;border-bottom:1px solid rgba(22,101,52,.12)">
            <span style="color:#5f7568;font-weight:600">${escapeAttr(label)}</span>
            <b style="font-family:ui-monospace,Consolas,monospace;text-align:right">${escapeAttr(value)}</b>
        </div>`;

    return Swal.fire({
        title: 'Account credentials',
        html: `
            <p style="margin:0 0 12px;color:#5f7568">Give these to ${escapeAttr(name)}. The password is shown only once.</p>
            <div style="text-align:left">
                ${line('Employee ID', employeeId)}
                ${line('Username', username)}
                ${line('Temporary password', temporaryPassword)}
            </div>
            <p style="margin:12px 0 0;color:#5f7568;font-size:13px">They must change it on their first sign-in.</p>
        `,
        icon: 'success',
        confirmButtonText: 'Done',
        confirmButtonColor: GREEN,
    });
}

export function confirmAction({ title, text, confirmText = 'Yes', icon = 'warning' }) {
    return Swal.fire({
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancel',
        confirmButtonColor: GREEN,
    }).then((result) => result.isConfirmed);
}

/** Generic form dialog. `fields` drives the `.admin-swal-field` inputs. */
export function inputDialog({ title, html, confirmText = 'Save' }) {
    return Swal.fire({
        title,
        html,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancel',
        confirmButtonColor: GREEN,
        focusConfirm: false,
        preConfirm: () => collectPopupValues(Swal.getPopup()),
    }).then((result) => (result.isConfirmed ? result.value : null));
}

/**
 * Field-driven dialog: pass [{ name, label, type, value, options, ... }] and
 * get back an object of the entered values, or null when cancelled.
 */
export function formDialog({ title, fields, confirmText = 'Save', validate }) {
    const html = `<div class="admin-swal-form">${fields
        .map((field) => {
            const attrs = [
                `name="${field.name}"`,
                `placeholder="${escapeAttr(field.placeholder || field.label || '')}"`,
                field.required ? 'required' : '',
                field.step ? `step="${field.step}"` : '',
                field.min !== undefined ? `min="${field.min}"` : '',
                field.readonly ? 'readonly' : '',
            ].filter(Boolean).join(' ');

            if (field.type === 'select') {
                const options = (field.options || [])
                    .map((option) => {
                        const value = typeof option === 'string' ? option : option.value;
                        const label = typeof option === 'string' ? option : option.label;
                        const selected = String(field.value) === String(value) ? 'selected' : '';
                        return `<option value="${escapeAttr(value)}" ${selected}>${escapeAttr(label)}</option>`;
                    })
                    .join('');
                return `<label class="admin-swal-field">${escapeAttr(field.label)}
                    <select class="swal2-select" ${attrs}>${options}</select></label>`;
            }

            if (field.type === 'search-select') {
                const options = (field.options || [])
                    .map((option) => {
                        const value = typeof option === 'string' ? option : option.value;
                        const label = typeof option === 'string' ? option : option.label;
                        const selected = String(field.value) === String(value) ? 'selected' : '';
                        return `<option value="${escapeAttr(value)}" ${selected}>${escapeAttr(label)}</option>`;
                    })
                    .join('');
                return `<label class="admin-swal-field ${field.type === 'search-select' ? 'movement-product-field' : ''}">${escapeAttr(field.label)}
                    ${field.hint ? `<small class="admin-swal-hint">${escapeAttr(field.hint)}</small>` : ''}
                    <input type="search" class="swal2-input product-search-input"
                        placeholder="${escapeAttr(field.searchPlaceholder || `Search ${field.label.toLowerCase()}...`)}"
                        autocomplete="off" data-search-for="${escapeAttr(field.name)}">
                    <select class="swal2-select" ${attrs}>${options}</select></label>`;
            }

            if (field.type === 'textarea') {
                return `<label class="admin-swal-field">${escapeAttr(field.label)}
                    <textarea class="swal2-textarea" ${attrs} rows="3">${escapeAttr(field.value ?? '')}</textarea></label>`;
            }

            return `<label class="admin-swal-field">${escapeAttr(field.label)}
                ${field.hint ? `<small class="admin-swal-hint">${escapeAttr(field.hint)}</small>` : ''}
                <input type="${field.type || 'text'}" class="swal2-input" ${attrs} value="${escapeAttr(field.value ?? '')}"></label>`;
        })
        .join('')}</div>`;

    return Swal.fire({
        title,
        html,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancel',
        confirmButtonColor: GREEN,
        focusConfirm: false,
        didOpen: (popup) => {
            popup?.querySelectorAll('[data-search-for]').forEach((searchInput) => {
                const select = popup.querySelector(`[name="${searchInput.dataset.searchFor}"]`);
                if (!select) return;
                const options = Array.from(select.options).map((option) => ({
                    value: option.value,
                    label: option.textContent,
                }));
                searchInput.addEventListener('input', () => {
                    const keyword = searchInput.value.trim().toLowerCase();
                    select.innerHTML = options
                        .filter((option) => option.label.toLowerCase().includes(keyword))
                        .map((option) => `<option value="${escapeAttr(option.value)}">${escapeAttr(option.label)}</option>`)
                        .join('');
                });
            });
        },
        preConfirm: () => {
            const values = collectPopupValues(Swal.getPopup());
            if (validate) {
                const problem = validate(values);
                if (problem) {
                    Swal.showValidationMessage(problem);
                    return undefined;
                }
            }
            return values;
        },
    }).then((result) => (result.isConfirmed ? result.value : null));
}

export { GREEN };
