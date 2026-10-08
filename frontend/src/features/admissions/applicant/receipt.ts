/** A retry belongs to one account/session, player and exact operation. Never reuse it for a sibling. */
export type PendingReceipt<T> = { requestId: string; payload: T };
export function receiptKey(account: string, subject: number, operation: string) {
    return `admission-retry:v1:${account}:${subject}:${operation}`;
}
export function readReceipt<T>(key: string): PendingReceipt<T> | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
        return value && typeof value.requestId === 'string' && typeof value.payload === 'object' && value.payload !== null ? value : null;
    } catch { return null; }
}
export function prepareReceipt<T>(key: string, payload: T): PendingReceipt<T> {
    const previous = readReceipt<T>(key);
    if (previous) {
        if (JSON.stringify(previous.payload) !== JSON.stringify(payload)) throw new Error('PENDING_RETRY');
        return previous;
    }
    const value = { requestId: crypto.randomUUID(), payload };
    // Persist before sending so interrupted responses can be retried after reload.
    sessionStorage.setItem(key, JSON.stringify(value));
    return value;
}
export function clearReceipt(key: string) { sessionStorage.removeItem(key); }

/** Also covers drafts from screens which are no longer mounted when the login ends. */
export function installAdmissionPrivacyCleanup(currentSession:()=>string|null) {
    const scrub=()=>{
        try {
            const session=currentSession();
            for(const key of Object.keys(sessionStorage)) {
                const parts=key.split(':');
                const storedSession=key.startsWith('admission-retry:v1:')?parts[3]:key.startsWith('admission-form:')?parts[2]:undefined;
                if(storedSession!==undefined&&storedSession!==String(session))sessionStorage.removeItem(key);
            }
        }catch{/* Storage may be unavailable; no network action is sent by this cleanup. */}
    };
    scrub();window.addEventListener('gk-auth-changed',scrub);window.addEventListener('storage',scrub);window.addEventListener('pageshow',scrub);
}
