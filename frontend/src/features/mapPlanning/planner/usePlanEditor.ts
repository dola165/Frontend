import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { emptyDraft, planGet, planPost, savePlan, type Plan, type PlanContext, type PlanDraft, type PlanPlace, type PlanSummary } from '../api';
import { draftFingerprint, forgetPlan, recoverPlan, recoveryKey, rememberPlan, rememberSelection, validatePlanDraft } from '../draftRecovery';

interface Editing {
    key: string; plan: Plan | null; draft: PlanDraft; pristine: PlanDraft; baseRevision: number | null; notice: string; error: string;
    /** The creation request (`draft`) this plan came from, so it stays open while the address changes to `plan`. */
    from?: string | null;
}

/**
 * A journey plan being edited: loading, local recovery, saving with revision checks,
 * commands (publish, approvals, travel) and the unsaved-changes guard. The URL says which
 * plan (`plan`) or new draft (`draft`, its creation request id) is open.
 */
export function usePlanEditor({ enabled, initialClubId }: { enabled: boolean; initialClubId?: number | null }) {
    const [params, setParams] = useSearchParams();
    const [session] = useState(getAuthSessionId);
    const planId = Number(params.get('plan')) || 0;
    const requestId = planId ? null : params.get('draft');
    const key = planId ? `plan:${planId}` : requestId ? `draft:${requestId}` : null;

    const [contexts, setContexts] = useState<PlanContext[] | null>(null);
    const [contextError, setContextError] = useState('');
    const [club, setClub] = useState(Number(params.get('club')) || initialClubId || 0);
    const [plans, setPlans] = useState<PlanSummary[] | null>(null);
    const [listVersion, setListVersion] = useState(0);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [loadVersion, setLoadVersion] = useState(0);
    const [busy, setBusy] = useState<'creating' | 'saving' | 'working' | null>(null);
    const [validation, setValidation] = useState<{ field: string; message: string } | null>(null);
    const [created, setCreated] = useState(false);
    const [recoveryWarning, setRecoveryWarning] = useState('');
    const [pending, setPending] = useState<null | (() => void)>(null);
    const inFlight = useRef(false);
    const skipLoad = useRef<number | null>(null);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const commandOwner = useRef({ key, loadVersion, enabled });
    if (commandOwner.current.key !== key || commandOwner.current.loadVersion !== loadVersion || commandOwner.current.enabled !== enabled) commandOwner.current = { key, loadVersion, enabled };
    const commandPending = useRef<object | null>(null);
    useEffect(() => { setBusy(null); }, [key, loadVersion, enabled]);

    // Which clubs and squads this person may plan for.
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void planGet<PlanContext[]>('/context', controller.signal).then(data => {
            setContexts(data);
            setClub(current => data.some(item => item.id === current) ? current : data[0]?.id || 0);
        }).catch(cause => { if (!controller.signal.aborted) { setContexts([]); setContextError(extractApiErrorMessage(cause, 'Your planning access could not load.')); } });
        return () => controller.abort();
    }, [enabled]);
    const context = contexts?.find(item => item.id === club);

    // The club's saved journeys.
    useEffect(() => {
        if (!enabled || !club || !contexts?.length) return;
        const controller = new AbortController();
        void planGet<PlanSummary[]>(`?clubId=${club}`, controller.signal).then(setPlans).catch(() => { if (!controller.signal.aborted) setPlans([]); });
        return () => controller.abort();
    }, [enabled, club, contexts, listVersion]);

    // Opening a saved plan: the server copy, unless this device holds newer unsaved work for it.
    useEffect(() => {
        if (!enabled || !planId) return;
        if (skipLoad.current === planId) { skipLoad.current = null; return; }
        const controller = new AbortController();
        void planGet<Plan>(`/${planId}`, controller.signal).then(plan => {
            if (controller.signal.aborted) return;
            const backup = recoverPlan(`plan:${plan.id}`);
            const recover = Boolean(backup && plan.rights.edit && backup.clubId === plan.club_id && backup.squadId === plan.squad_id);
            setEditing({
                key: `plan:${plan.id}`, plan, draft: recover ? backup!.draft : plan.draft, pristine: plan.draft, baseRevision: recover ? backup!.baseRevision : null,
                notice: recover ? 'Your unsaved changes were recovered.' : '',
                error: recover && backup!.baseRevision !== plan.revision ? 'This plan changed elsewhere since your unsaved work. Your work is kept; reload the saved plan to review before replacing it.' : '',
            });
            setClub(plan.club_id);
            rememberSelection(plan.id, plan.club_id, plan.squad_id, session);
        }).catch(cause => {
            if (!controller.signal.aborted) setEditing({ key: `plan:${planId}`, plan: null, draft: emptyDraft(), pristine: emptyDraft(), baseRevision: null, notice: '', error: extractApiErrorMessage(cause, 'This plan could not load.') });
        });
        return () => controller.abort();
    }, [enabled, planId, loadVersion, session]);

    // A new draft starts empty, or from this device's unsaved copy of the same request.
    const squadParam = Number(params.get('squad')) || 0;
    // The router changes the address in a transition, a render after a created plan is stored; until then the
    // address still names the draft, and the new plan must not be replaced by an empty one.
    if (requestId && context && editing?.key !== key && editing?.from !== requestId) {
        const backup = recoverPlan(`draft:${requestId}`);
        const allowed = backup && !backup.planId && backup.clubId === club && context.squads.some(item => item.id === backup.squadId && item.canEdit);
        const draft = allowed ? backup.draft : emptyDraft(context);
        setEditing({ key: key!, plan: null, draft, pristine: allowed ? backup.baseDraft : draft, baseRevision: null, notice: allowed ? 'Your unsaved draft was recovered.' : '', error: '' });
    }
    const current = editing && (editing.key === key || (requestId !== null && editing.from === requestId)) ? editing : null;
    const plan = current?.plan ?? null;
    const draft = current?.draft ?? null;
    const squad = plan?.squad_id ?? squadParam ?? 0;
    const dirty = Boolean(current && draftFingerprint(current.draft) !== draftFingerprint(current.plan?.draft ?? current.pristine));
    const canEdit = plan ? plan.rights.edit : Boolean(context?.squads.find(item => item.id === squad)?.canEdit);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const retain = (next: PlanDraft, base: PlanDraft, id: number, revision: number | null) => {
        const ok = rememberPlan({ key: recoveryKey(id, requestId ?? String(id)), planId: id, clubId: club, squadId: squad, requestId: requestId ?? String(id), baseRevision: revision, baseDraft: base, draft: next, savedAt: Date.now() }, session);
        setRecoveryWarning(ok ? '' : 'This browser cannot keep a recovery copy. Save your plan before leaving.');
    };
    const change = (patch: Partial<PlanDraft>) => {
        if (!current || !canEdit) return;
        const next = { ...current.draft, ...patch };
        setEditing({ ...current, draft: next, notice: '' });
        setValidation(null);
        retain(next, current.plan?.draft ?? current.pristine, current.plan?.id ?? 0, current.baseRevision ?? current.plan?.revision ?? null);
    };
    /** Keeps the newer local draft when a saved copy comes back older (a retried create). */
    const received = (saved: Plan, kept?: PlanDraft) => {
        if (!mounted.current) return;
        forgetPlan(recoveryKey(current?.plan?.id ?? 0, requestId ?? String(current?.plan?.id ?? 0)), session);
        if (saved.id !== planId) skipLoad.current = saved.id;
        setEditing({ key: `plan:${saved.id}`, from: current?.plan ? null : requestId, plan: saved, draft: kept ?? saved.draft, pristine: saved.draft, baseRevision: null, notice: kept ? 'Plan created. Your newer changes are kept; save them to update it.' : 'All changes saved', error: '' });
        rememberSelection(saved.id, saved.club_id, saved.squad_id, session);
        setPlans(list => list ? [{ ...saved, starts_at: saved.draft.startsAt }, ...list.filter(item => item.id !== saved.id)] : list);
        setParams(next => { next.set('plan', String(saved.id)); next.delete('draft'); next.set('plans', 'staff'); next.set('club', String(saved.club_id)); next.set('squad', String(saved.squad_id)); return next; }, { replace: true });
        if (kept) retain(kept, saved.draft, saved.id, saved.revision);
    };

    const persist = async (): Promise<Plan | null> => {
        if (!current || inFlight.current || !canEdit) return null;
        const invalid = validatePlanDraft(current.draft);
        if (invalid) { setValidation(invalid); return null; }
        inFlight.current = true;
        setBusy(plan ? 'saving' : 'creating'); setValidation(null);
        setEditing({ ...current, error: '' });
        try {
            const result = plan
                ? await savePlan(plan.id, current.baseRevision ?? plan.revision, current.draft)
                : await planPost('', { requestId, clubId: club, squadId: squad, draft: current.draft });
            const kept = !plan && draftFingerprint(result.draft) !== draftFingerprint(current.draft) ? current.draft : undefined;
            received(result, kept);
            if (!plan) setCreated(true);
            return result;
        } catch (cause) {
            if (mounted.current) setEditing(value => value && value.key === current.key ? { ...value, error: extractApiErrorMessage(cause, 'Not saved. Your changes are kept here; you can try again.') } : value);
            return null;
        } finally {
            inFlight.current = false;
            if (mounted.current) setBusy(null);
        }
    };
    /** A recorded decision (publish, approve, travel milestone) on the saved plan. */
    const command = async (path: string, extra: Record<string, unknown> = {}) => {
        const owner = commandOwner.current;
        const active = () => mounted.current && owner.enabled && commandOwner.current === owner && isCurrentAuthSession(session);
        if (!plan || busy || commandPending.current === owner || !active()) return false;
        if (dirty) { setEditing({ ...current!, error: 'Save your changes before publishing or recording a decision.' }); return false; }
        commandPending.current = owner; setBusy('working');
        try {
            const saved = await planPost(`/${plan.id}/${path}`, { revision: plan.revision, ...extra });
            if (!active()) return false;
            received(saved);
            return true;
        } catch (cause) {
            if (active()) setEditing(value => value?.key === owner.key ? { ...value, error: extractApiErrorMessage(cause, 'That was not completed. Try again.') } : value);
            return false;
        } finally {
            if (commandPending.current === owner) commandPending.current = null;
            if (mounted.current && commandOwner.current === owner) setBusy(null);
        }
    };
    /** Drops unsaved work, on this device too; the saved plan loads again when it is next opened. */
    const discard = () => { forgetPlan(recoveryKey(plan?.id ?? 0, requestId ?? String(plan?.id ?? 0)), session); setValidation(null); setEditing(null); };
    /** Runs `next` now, or after the person decides what happens to unsaved changes. */
    const guard = useCallback((next: () => void) => { if (dirty) setPending(() => next); else next(); }, [dirty]);
    const route = (mutate: (next: URLSearchParams) => void) => setParams(current => { const next = new URLSearchParams(current); mutate(next); return next; });

    return {
        contexts, contextError, context, club, squad, plans, plan, draft, dirty, canEdit, busy, validation, created, recoveryWarning,
        loading: enabled && (contexts === null || Boolean(key && !current)),
        notice: current?.notice ?? '', error: current?.error ?? '',
        pending, setPending,
        change, persist, command, discard, guard, received,
        dismissCreated: () => setCreated(false),
        reload: () => guard(() => { discard(); setLoadVersion(value => value + 1); }),
        refreshList: () => setListVersion(value => value + 1),
        selectClub: (id: number) => { setClub(id); setPlans(null); },
        /** Opens a saved plan; the link names its club and squad so it can be shared. */
        open: (summary: Pick<PlanSummary, 'id' | 'club_id' | 'squad_id'>) => guard(() => route(next => {
            next.set('plans', 'staff'); next.set('plan', String(summary.id)); next.set('club', String(summary.club_id)); next.set('squad', String(summary.squad_id));
            ['draft', 'view', 'step'].forEach(name => next.delete(name));
        })),
        /** Starts a new private draft for a squad. */
        start: (clubId: number, squadId: number) => guard(() => route(next => {
            next.set('plans', 'staff'); next.delete('plan'); next.delete('view'); next.delete('step');
            next.set('draft', crypto.randomUUID()); next.set('club', String(clubId)); next.set('squad', String(squadId));
        })),
        /** Reopens this device's unsaved draft. */
        resume: (draftId: string, clubId: number, squadId: number) => guard(() => route(next => {
            next.set('plans', 'staff'); next.delete('plan'); next.set('draft', draftId); next.set('club', String(clubId)); next.set('squad', String(squadId));
        })),
        /** Back to the list of journeys. */
        home: () => guard(() => route(next => { ['plan', 'draft', 'view', 'step', 'club', 'squad'].forEach(name => next.delete(name)); next.set('plans', 'staff'); })),
        /** Leaves planning for the map. */
        exit: () => guard(() => route(next => { ['plans', 'plan', 'draft', 'view', 'step', 'club', 'squad', 'journey', 'journeyChild'].forEach(name => next.delete(name)); })),
        addPlace: (place: PlanPlace) => {
            if (!draft) return false;
            if (draft.places.some(item => item.key === place.key)) return true;
            if (draft.places.length >= 60) { setEditing({ ...current!, error: 'This plan has 60 saved places. Remove one before adding another.' }); return false; }
            change({ places: [...draft.places, place] });
            return true;
        },
    };
}
export type PlanEditor = ReturnType<typeof usePlanEditor>;
