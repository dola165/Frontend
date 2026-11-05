import type { AuthSessionId } from '../../utils/authStorage';

/** Only opaque command ids are retained; a route detour must not turn an uncertain answer into a new command. */
export function homeJoinCommands(session: AuthSessionId, squad: number) {
    const storageKey = `gk.home-join:${session}:${squad}`;
    let saved: Record<string, string> = {};
    try { const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, string>; } catch { /* memory retry still works */ }
    return (key: string) => {
        if (!saved[key]) { saved[key] = crypto.randomUUID(); try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* memory only */ } }
        return saved[key];
    };
}
