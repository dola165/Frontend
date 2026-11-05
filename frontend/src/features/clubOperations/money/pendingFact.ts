import type { MoneyCommand } from './api';

export interface PendingFact { key: string; body?: MoneyCommand }
/** A tab/session-scoped immutable retry, never shared across account/session identities. */
export function pendingFact(scope: string): PendingFact | null {
    const stored = sessionStorage.getItem(scope);
    if (!stored) return null;
    // Earlier versions retained only the key; the authenticated recovery command reconciles it.
    if (/^[0-9a-f-]{36}$/i.test(stored)) return { key: stored };
    const parsed = JSON.parse(stored) as { version?: number; key?: string; body?: MoneyCommand };
    if (parsed.version !== 1 || !parsed.key || !parsed.body) throw new Error('The pending fact cannot be read. No new fact was sent.');
    return { key: parsed.key, body: parsed.body };
}
export function keepPendingFact(scope: string, request: PendingFact) {
    const current = pendingFact(scope);
    if (current) {
        if (current.key !== request.key || JSON.stringify(current.body) !== JSON.stringify(request.body)) throw new Error('Another immutable fact is pending.');
        return;
    }
    sessionStorage.setItem(scope, JSON.stringify({ version: 1, ...request }));
}
/** A late response may retire only its own operation, never a newer request in this slot. */
export function clearPendingFact(scope: string, expectedKey: string): boolean {
    if (pendingFact(scope)?.key !== expectedKey) return false;
    sessionStorage.removeItem(scope);
    return true;
}
