/**
 * An under-13 refusal is remembered on this device for a day, so trying again at once with an older birth date
 * shows the same answer. Only the time is kept: no birth date, name or email (nothing about a child is stored).
 */
const KEY = 'grasskickz.age-refusal.v1';
export const REFUSAL_HOURS = 24;

export const rememberAgeRefusal = (now = Date.now()) => {
    try { window.localStorage.setItem(KEY, String(now)); } catch { /* Storage may be blocked; the server still refuses. */ }
};

export const ageRefusedRecently = (now = Date.now()) => {
    try {
        const at = Number(window.localStorage.getItem(KEY));
        return Number.isFinite(at) && at > 0 && now - at < REFUSAL_HOURS * 3_600_000;
    } catch { return false; }
};
