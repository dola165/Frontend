// Shared age helpers for the minors framework (WEB_APP_MASTER_PLAN.md §2.1, F1 of 26 October 2026).

/**
 * Years since a date of birth. A typed date always gives a number (NaN when it is not a date); an account's birth date
 * may be missing, and then the age is null.
 */
export function ageFromDob(dob: string): number;
export function ageFromDob(dob?: string | null): number | null;
export function ageFromDob(dob?: string | null): number | null {
    if (dob == null) return null;
    const born = new Date(`${dob.slice(0, 10)}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const monthDiff = now.getMonth() - born.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age--;
    return age;
}

export const ADULT_AGE = 18;

/**
 * The one meaning of "adult": a known birth date 18 or more years ago. A missing birth date is not adult, mirroring the
 * backend's MinorPolicy; adult-only actions ask for the birth date instead of assuming it.
 */
export const isAdult = (dob?: string | null): boolean => { const age = ageFromDob(dob); return age != null && Number.isFinite(age) && age >= ADULT_AGE; };
/** Not known to be an adult: under 18, or no birth date yet. */
export const isMinor = (dob?: string | null): boolean => !isAdult(dob);
/** Known to be under 18: what such a person cannot do is hidden. With no birth date, the action asks for it instead. */
export const isKnownMinor = (dob?: string | null): boolean => { const age = ageFromDob(dob); return age != null && Number.isFinite(age) && age < ADULT_AGE; };

export const isUnder13 = (dob: string): boolean => ageFromDob(dob) < 13;

export const todayIso = (): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
