// Shared age helpers for the minors framework (WEB_APP_MASTER_PLAN.md §2.1).
// Used by the registration form and the Google DOB capture screen.

export const ageFromDob = (dob: string): number => {
    const dobDate = new Date(`${dob}T00:00:00`);
    const now = new Date();
    let age = now.getFullYear() - dobDate.getFullYear();
    const monthDiff = now.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dobDate.getDate())) {
        age--;
    }
    return age;
};

export const isUnder13 = (dob: string): boolean => ageFromDob(dob) < 13;

export const isMinor = (dob?: string | null): boolean => {
    // Aug 17 fail-safe: missing DOB = minor (mirrors backend MinorPolicy) —
    // unknown age gets the restrictions until the DOB gate is completed.
    if (!dob) return true;
    return ageFromDob(dob) < 18;
};

export const todayIso = (): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
