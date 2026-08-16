// Carries the full name typed on the registration form into the onboarding
// wizard without sending it to /auth/register (the backend CreateUserDto has
// no name field — PLATFORM_HARDENING_PLAN.md P3: "name surfaced in the form,
// no backend change"). sessionStorage: dies with the tab, so a stale value
// can only leak within one tab session and is overwritten on the next submit.

const PENDING_NAME_KEY = 'pendingName';

export const setPendingName = (name: string): void => {
    try {
        sessionStorage.setItem(PENDING_NAME_KEY, name.trim());
    } catch {
        // storage disabled or quota exceeded — prefill is a nicety, never fatal
    }
};

export const getPendingName = (): string | null => {
    try {
        return sessionStorage.getItem(PENDING_NAME_KEY);
    } catch {
        return null;
    }
};

export const clearPendingName = (): void => {
    try {
        sessionStorage.removeItem(PENDING_NAME_KEY);
    } catch {
        // ignore
    }
};
