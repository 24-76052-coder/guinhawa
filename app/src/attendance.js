import { isoDate, store, useStore } from './store.js';

/**
 * Clock-in / clock-out records for the counter staff.
 *
 * The rows live in MySQL (`attendance` table) and arrive with the rest of the
 * state snapshot. These helpers only read that snapshot and post movements,
 * so two browsers always see the same shift record.
 */

export function useAttendance() {
    return useStore().attendance || [];
}

export function recordFor(code, day = isoDate()) {
    return (store.getState().attendance || [])
        .find((record) => record.code === code && record.date === day) || null;
}

export async function clockIn({ code, name }) {
    await store.clockIn({ code, name });
    return recordFor(code);
}

export async function clockOut(code) {
    await store.clockOut({ code });
    return recordFor(code);
}

/** The last `count` days, newest first, with or without a record. */
export function recentDays(count = 7) {
    const days = [];
    for (let index = 0; index < count; index += 1) {
        const date = new Date();
        date.setDate(date.getDate() - index);
        days.push(isoDate(date));
    }
    return days;
}
