import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { planGet, type FamilyPlan } from '../api';

/** Loads the journeys shared with this person and their replies. */
export function useFamilyJourneys(enabled: boolean) {
    const [state, setState] = useState<{ items: FamilyPlan[]; error: string } | null>(null);
    const [version, setVersion] = useState(0);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void planGet<FamilyPlan[]>('/family', controller.signal).then(items => setState({ items, error: '' }))
            .catch(cause => { if (!controller.signal.aborted) setState(current => ({ items: current?.items ?? [], error: extractApiErrorMessage(cause, 'Your journeys could not load.') })); });
        return () => controller.abort();
    }, [enabled, version]);
    return {
        items: state?.items ?? [], loading: enabled && !state, error: state?.error ?? '', busy, actionError,
        refresh: () => setVersion(value => value + 1),
        act: async (run: () => Promise<unknown>) => {
            if (busy) return;
            setBusy(true); setActionError('');
            try { await run(); setVersion(value => value + 1); }
            catch (cause) { setActionError(extractApiErrorMessage(cause, 'Your reply was not saved. Try again.')); }
            finally { setBusy(false); }
        },
    };
}
export type FamilyJourneysState = ReturnType<typeof useFamilyJourneys>;
