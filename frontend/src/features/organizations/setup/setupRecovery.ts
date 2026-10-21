// Recovery contains organization setup data only. It is scoped to one account
// and browser tab; it never grants authority or contains credentials or files.
const prefix = 'gk.first-use.v1:';

export function readSetupRecovery<T>(accountId: number | undefined, purpose: string, valid: (value: unknown) => value is T): T | null {
  if (!Number.isSafeInteger(accountId) || Number(accountId) <= 0) return null;
  try {
    const raw = sessionStorage.getItem(`${prefix}${accountId}:${purpose}`);
    if (!raw || raw.length > 2_500_000) return null;
    const stored = JSON.parse(raw) as { accountId?: number; value?: unknown };
    return stored?.accountId === accountId && valid(stored.value) ? stored.value : null;
  } catch { return null; }
}

export function writeSetupRecovery(accountId: number | undefined, purpose: string, value: unknown): boolean {
  if (!Number.isSafeInteger(accountId) || Number(accountId) <= 0) return false;
  try {
    const serialized = JSON.stringify({ accountId, value });
    if (serialized.length > 2_500_000) return false;
    sessionStorage.setItem(`${prefix}${accountId}:${purpose}`, serialized);
    return true;
  } catch { return false; }
}

export function clearSetupRecovery(accountId: number | undefined, purpose: string) {
  try { sessionStorage.removeItem(`${prefix}${accountId}:${purpose}`); } catch { /* Storage may be disabled. */ }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const isRequestId = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
