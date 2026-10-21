import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, getStoredAccessToken, getStoredUserId, subscribeAuthSession } from '../../utils/authStorage';
import type { Match, Squad } from './api';
import { matchGates } from './detail/matchState';
import { offerToPlay } from './detail/opponentActions';

interface OfferDraft {
    squadId?: number | null;
    note: string;
    edited: boolean;
    pending?: symbol;
    error: string;
    changed: boolean;
    notice: string;
    acknowledged?: { squadId: number; revision: number; observedRevision: number; proposalId?: number; pendingRevision?: number };
}
const empty: OfferDraft = { note: '', edited: false, error: '', changed: false, notice: '' };
const storedScope = () => {
    const session = getAuthSessionId(), user = getStoredUserId();
    return session && user && getStoredAccessToken(session) ? JSON.stringify([session, user]) : null;
};
let memory = { scope: storedScope(), drafts: new Map<number, OfferDraft>() };
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };
const retire = () => {
    const scope = storedScope();
    if (scope === memory.scope) return;
    memory = { scope, drafts: new Map() };
    emit();
};
let watchingAuth = false;
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Keep this single auth listener after the forms unmount: their private memory must retire too.
    if (!watchingAuth) { subscribeAuthSession(retire); watchingAuth = true; }
    retire();
    return () => { listeners.delete(listener); };
};
const snapshot = () => memory;
const put = (scope: string | null, id: number, draft: OfferDraft) => {
    if (!scope || memory.scope !== scope || storedScope() !== scope) return;
    memory = { ...memory, drafts: new Map(memory.drafts).set(id, draft) };
    emit();
};
const isOwner = (scope: string | null, session: ReturnType<typeof getAuthSessionId>, status: string, userId: number | undefined) => Boolean(
    scope && storedScope() === scope && memory.scope === scope && status === 'authenticated'
    && session === getAuthSessionId() && String(userId) === getStoredUserId());

function reconcile(scope: string | null, match: Match, squads: Squad[]) {
    const draft = memory.drafts.get(match.event_id), acknowledgment = draft?.acknowledged;
    if (!draft || draft.pending || !acknowledgment || match.revision <= acknowledgment.revision || match.revision < acknowledgment.observedRevision) return;
    // Both contracts keep one proposal per listing/squad and retain its id when replacing it.
    const proposal = match.proposals?.find(item => item.squad_id === acknowledgment.squadId
        && (acknowledgment.proposalId === undefined || item.id === acknowledgment.proposalId));
    const resolved = proposal && ['WITHDRAWN', 'DECLINED'].includes(proposal.status)
        && match.revision > (acknowledgment.pendingRevision ?? acknowledgment.revision);
    if (resolved && matchGates(match, Date.now(), squads).canPropose) {
        put(scope, match.event_id, { ...empty });
        return;
    }
    const proposalId = acknowledgment.proposalId ?? proposal?.id;
    const pendingRevision = proposal?.status === 'PENDING' ? match.revision : acknowledgment.pendingRevision;
    if (match.revision > acknowledgment.observedRevision || proposalId !== acknowledgment.proposalId || pendingRevision !== acknowledgment.pendingRevision) {
        put(scope, match.event_id, { ...draft, acknowledged: { ...acknowledgment, observedRevision: match.revision, proposalId, pendingRevision } });
    }
}

/** Observe current proposal reads even while the drawer shows ProposalList instead of OfferStep. */
export function useOfferProjection(match: Match | undefined, squads: Squad[]) {
    const auth = useAuth();
    const state = useSyncExternalStore(subscribe, snapshot);
    useEffect(() => {
        if (match && isOwner(state.scope, auth.sessionId, auth.status, auth.user?.id)) reconcile(state.scope, match, squads);
    }, [state, match, squads, auth.sessionId, auth.status, auth.user?.id]);
}

/** One listing's unfinished offer, shared only within this page lifetime and confirmed login. Nothing is stored. */
export function useOfferDraft(match: Match, squads: Squad[], preferred: number | undefined,
    saved: (notice: string) => void, conflict?: () => void) {
    const auth = useAuth();
    const state = useSyncExternalStore(subscribe, snapshot);
    const scope = state.scope, id = match.event_id;
    const current = useCallback(() => isOwner(scope, auth.sessionId, auth.status, auth.user?.id), [scope, auth.status, auth.sessionId, auth.user?.id]);
    const ready = current();
    const draft = ready ? state.drafts.get(id) ?? empty : empty;
    const eligible = squads.filter(squad => squad.club_id !== match.club_id);
    const chosen = draft.squadId === undefined ? preferred : draft.squadId;
    const squad = eligible.find(item => item.id === chosen);
    const busy = Boolean(draft.pending);
    const editable = ready && !busy && !draft.notice;

    useEffect(() => {
        if (current()) reconcile(scope, match, squads);
    }, [current, scope, match, squads, draft]);

    useEffect(() => {
        if (!editable) return;
        // Seed an untouched smart default once so the other form gets the same context.
        if (draft.squadId === undefined && squad) put(scope, id, { ...draft, squadId: squad.id });
        // Losing eligibility preserves the note and requires an explicit new choice, even if rights return.
        else if (draft.squadId != null && !squad) put(scope, id, { ...draft, squadId: null });
    }, [draft, editable, id, squad, scope]);

    const previous = useRef({ scope, id, draft });
    useEffect(() => {
        const before = previous.current;
        previous.current = { scope, id, draft };
        if (!ready || !current() || before.scope !== scope || before.id !== id || !before.draft.pending || draft.pending) return;
        // Only a currently mounted view may refresh or show its action receipt; old route callbacks stay retired.
        if (draft.notice) saved(draft.notice);
        else if (draft.changed) conflict?.();
    }, [draft, id, scope, ready, saved, conflict, current]);

    const change = (patch: { squadId?: number | null; note?: string }) => {
        if (!current()) return;
        const latest = memory.drafts.get(id) ?? empty;
        if (latest.pending || latest.notice) return;
        if (patch.squadId != null && !eligible.some(item => item.id === patch.squadId)) return;
        put(scope, id, { ...latest, squadId: squad?.id ?? null, ...patch, edited: true });
    };
    const discard = () => {
        if (!current()) return;
        const latest = memory.drafts.get(id) ?? empty;
        if (!latest.pending && !latest.notice) put(scope, id, { ...empty });
    };
    const send = async (done: string, failed: string) => {
        if (!current()) return;
        const latest = memory.drafts.get(id) ?? empty;
        const chosen = latest.squadId === undefined ? preferred : latest.squadId;
        const gates = matchGates(match, Date.now(), squads);
        if (latest.pending || latest.notice || !gates.canPropose || !gates.eligible.some(item => item.id === chosen)) return;
        const pending = Symbol('offer');
        const session = auth.sessionId;
        const previous = match.proposals?.find(item => item.squad_id === chosen);
        const acknowledged = { squadId: chosen!, revision: match.revision, observedRevision: match.revision,
            proposalId: previous?.id, pendingRevision: previous?.status === 'PENDING' ? match.revision : undefined };
        put(scope, id, { ...latest, squadId: chosen, pending, error: '', changed: false });
        const ownsReply = () => current() && memory.drafts.get(id)?.pending === pending;
        try {
            await offerToPlay(match, chosen!, latest.note, session);
            if (ownsReply()) put(scope, id, { ...empty, squadId: null, notice: done, acknowledged });
        } catch (error) {
            if (!ownsReply()) return;
            const changed = isAxiosError(error) && error.response?.status === 409;
            put(scope, id, { ...memory.drafts.get(id)!, pending: undefined, changed,
                error: extractApiErrorMessage(error, changed ? 'This match changed since you opened it.' : failed) });
        }
    };
    return { ...draft, squad, busy, editable, change, discard, send };
}
