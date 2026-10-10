import { useState } from 'react';
import type { Draft } from './matchPlan';

/**
 * The form's draft, kept in session storage so leaving the page (or a failed send) never loses it.
 * The request id travels with the draft, so retrying a send cannot create a second match.
 */
export function useDraft(storageKey: string | null, initial: () => Draft) {
    const [draft, setDraft] = useState<Draft>(() => {
        if (!storageKey) return initial();
        try {
            const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Partial<Draft> | null;
            return stored ? { ...initial(), ...stored } : initial();
        } catch { return initial(); }
    });
    const save = (next: Draft) => {
        if (!storageKey) return;
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The draft stays in memory. */ }
    };
    const patch = (value: Partial<Draft>) => setDraft(old => { const next = { ...old, ...value }; save(next); return next; });
    const clear = () => { if (storageKey) try { sessionStorage.removeItem(storageKey); } catch { /* Nothing stored. */ } };
    const reset = () => { clear(); setDraft({ ...initial(), requestId: crypto.randomUUID() }); };
    return { draft, patch, reset, clear };
}
