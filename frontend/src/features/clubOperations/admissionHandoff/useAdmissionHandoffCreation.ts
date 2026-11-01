import { useRef, useState } from 'react';
import { createHandoffRecord, type HandoffRecord, type HandoffScope, type HandoffTarget } from './api';

function marker(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }

/** Reuses the canonical creation receipt; storage contains only an opaque unresolved key. */
export function useAdmissionHandoffCreation(scope: HandoffScope, target: HandoffTarget) {
    const storageKey = `gk-record-create:${scope.actorId}:${scope.clubId}:admission:${scope.caseId}:${target}:${scope.sessionId}`;
    const [blocked] = useState(() => Boolean(marker(storageKey)));
    const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
    const attempt = useRef<{ key: string; body: HandoffRecord } | null>(null), lock = useRef(false);
    const create = async (draft: HandoffRecord) => {
        if (lock.current || blocked) return;
        lock.current = true; setBusy(true);
        const recovering = attempt.current !== null;
        const request = attempt.current ?? { key: crypto.randomUUID(), body: structuredClone(draft) };
        attempt.current = request;
        try { sessionStorage.setItem(storageKey, request.key); } catch { /* Keep exact request in memory. */ }
        try {
            const saved = await createHandoffRecord(scope, target, request.body, request.key);
            try { sessionStorage.removeItem(storageKey); } catch { /* No private payload persisted. */ }
            attempt.current = null; setUncertain(false); return saved;
        } catch (failure) {
            const status = (failure as { response?: { status?: number } }).response?.status;
            // Same definite-rejection boundary as useRecordCreation. An uncertain retry or
            // consumed-key conflict always retains the original identity and payload.
            if (!recovering && status && [400, 401, 403, 404, 422].includes(status)) {
                attempt.current = null; setUncertain(false);
                try { sessionStorage.removeItem(storageKey); } catch { /* No payload persisted. */ }
            } else setUncertain(true);
            throw failure;
        } finally { lock.current = false; setBusy(false); }
    };
    return { create, busy, uncertain, blocked };
}
