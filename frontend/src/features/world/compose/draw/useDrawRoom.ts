import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '../../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../../utils/apiError';
import { createCompetition, type CompetitionRules, type EligibilityPolicy } from '../../../competitions/api';
import { readIntent, writeIntent } from '../../../competitions/commandRecovery';
import { competitionInstant } from '../../../competitions/competitionTime';
import { fetchMyOrganizations, fetchTournamentHostClubs } from '../../../tournaments/api';
import { clearDrawDraft, drawDraftKey, freshDraft, loadDrawDraft, saveDrawDraft, type DrawDraft, type DrawSeed } from '../../../tournaments/create/drawDraft';
import type { CreateTournamentPayload, TournamentDetail } from '../../../tournaments/domain';
import { useWorldData } from '../../useWorldData';

/** What stops the tournament being created, and the field it is about (focused when Create is pressed). */
export interface DrawProblem { field: string; message: string; vars?: Record<string, string | number> }

/** The checks the backend makes, said before sending: in the order the form asks. */
export function drawProblem(draft: DrawDraft, organizerId: number | null, now: number): DrawProblem | null {
    const { rules } = draft;
    const at = (value: string) => { try { return value ? competitionInstant(value, rules.timezone).getTime() : null; } catch { return Number.NaN; } };
    const youth = /^U\d+$/.test(rules.ageGroup), start = at(draft.startDate), end = at(draft.endDate), opens = at(draft.opensAt), closes = at(draft.closesAt);
    if (organizerId == null) return { field: 'organiser', message: 'Choose who organises it.' };
    if (draft.scope === 'PLAYER' && youth && Number(rules.ageGroup.slice(1)) <= 18) return { field: 'scope', message: 'Youth tournaments take club or squad entries; players enter on their own only as adults.' };
    if (draft.entryCap < 2 || draft.entryCap > 32) return { field: 'entryCap', message: 'Choose between 2 and 32 teams.' };
    if (start == null || end == null) return { field: 'startDate', message: 'Choose when it starts and ends.' };
    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(opens) || Number.isNaN(closes)) return { field: 'startDate', message: 'Choose a valid date and time.' };
    if (start <= now) return { field: 'startDate', message: 'Choose a start in the future.' };
    if (end < start) return { field: 'endDate', message: 'It ends after it starts.' };
    if (closes != null && closes > start) return { field: 'closesAt', message: 'Entries close before it starts.' };
    if (opens != null && closes != null && opens > closes) return { field: 'opensAt', message: 'Entries open before they close.' };
    if (youth && !rules.ageCutoff) return { field: 'ageCutoff', message: 'A youth tournament needs the date ages count from.' };
    if (rules.matchMinutes > draft.policy.maximumMatchMinutes) return { field: 'matchMinutes', message: 'Matches are longer than this age allows ({max} minutes).', vars: { max: draft.policy.maximumMatchMinutes } };
    if (!rules.ruleset.trim()) return { field: 'ruleset', message: 'Say which rules apply.' };
    if (!rules.seasonPolicy.trim()) return { field: 'seasonPolicy', message: 'Say how results stand.' };
    if (!draft.name.trim()) return { field: 'name', message: 'Name the tournament.' };
    return null;
}

const payloadOf = (draft: DrawDraft, organizerId: number): CreateTournamentPayload => ({
    organizerOrganizationId: organizerId, hostClubId: draft.hostClubId, name: draft.name.trim(), description: draft.description.trim() || null, rules: draft.writtenRules.trim() || null,
    participantScope: draft.scope, visibility: draft.visibility, registrationOpensAt: draft.opensAt || null, registrationClosesAt: draft.closesAt || null,
    startDate: draft.startDate, endDate: draft.endDate, locationId: null, bannerImageUrl: draft.bannerImageUrl || null, incentives: draft.incentives.trim() || null,
    entryCap: draft.entryCap, registrationPolicy: draft.registrationPolicy,
});

/**
 * The Draw room's state: the organisers the person may create for (the only one chosen for them), the clubs that may
 * host, the draft kept in the browser tab as it is written, the checks, and one create call made safe to repeat (its
 * request id is kept until the server answers, so a lost answer is recovered rather than sent twice).
 */
export function useDrawRoom(seed: DrawSeed, ageHint: string) {
    const { user, sessionId } = useAuth();
    const key = drawDraftKey(user?.id, sessionId), intentKey = `${key}:create`;
    const [draft, setDraft] = useState<DrawDraft>(() => loadDrawDraft(key) ?? freshDraft(seed, ageHint));
    useEffect(() => saveDrawDraft(key, draft), [key, draft]);
    const organisations = useWorldData(user ? `my-organisations:${sessionId}` : null, () => fetchMyOrganizations(), 'Your organisations could not load.');
    const creatable = (organisations.data ?? []).filter(organisation => organisation.canCreateTournament);
    const organizerId = creatable.some(organisation => organisation.id === draft.organizerId) ? draft.organizerId : creatable[0]?.id ?? null;
    const hostClubs = useWorldData(organizerId ? `host-clubs:${organizerId}` : null, () => fetchTournamentHostClubs(organizerId!));
    const update = (patch: Partial<DrawDraft>) => setDraft(current => ({ ...current, ...patch, savedAt: Date.now() }));
    const updateRules = (patch: Partial<CompetitionRules>) => setDraft(current => ({ ...current, rules: { ...current.rules, ...patch }, savedAt: Date.now() }));
    const updatePolicy = (patch: Partial<EligibilityPolicy>) => setDraft(current => ({ ...current, policy: { ...current.policy, ...patch }, savedAt: Date.now() }));
    const [sending, setSending] = useState({ busy: false, error: '' });
    const [pending, setPending] = useState(() => readIntent(intentKey));
    const request = useRef<{ key: string; requestId: string } | null>(null);
    /** Sends what is kept under one request id; a refusal (4xx) forgets it, so a corrected draft is a new request. */
    const send = async (submitted: string, run: (requestId: string) => Promise<TournamentDetail>) => {
        setSending({ busy: true, error: '' });
        try {
            const created = await run(request.current!.requestId);
            writeIntent(intentKey, undefined); clearDrawDraft(key); setPending(undefined);
            setSending({ busy: false, error: '' });
            return created;
        } catch (cause) {
            if (isAxiosError(cause) && cause.response && cause.response.status < 500) { writeIntent(intentKey, undefined); request.current = null; setPending(undefined); }
            setSending({ busy: false, error: extractApiErrorMessage(cause, 'The tournament could not be created.') });
            void submitted;
            return null;
        }
    };
    const create = async () => {
        if (organizerId == null || sending.busy) return null;
        const payload = payloadOf(draft, organizerId);
        const submitted = JSON.stringify({ payload, rules: draft.rules, policy: draft.policy, venueId: draft.venueId });
        const stored = readIntent(intentKey);
        if (stored && stored.key !== submitted) { setSending({ busy: false, error: 'An earlier Create still waits for an answer. Recover it before changing the details.' }); return null; }
        if (stored) request.current = { key: submitted, requestId: stored.requestId };
        if (request.current?.key !== submitted) request.current = { key: submitted, requestId: crypto.randomUUID() };
        writeIntent(intentKey, { key: submitted, requestId: request.current.requestId, revision: 0 });
        return send(submitted, requestId => createCompetition(payload, draft.rules, requestId, draft.policy, draft.venueId));
    };
    /** Sends the earlier Create again, exactly as it was, under its own request id. */
    const recover = async () => {
        if (!pending || sending.busy) return null;
        const saved = JSON.parse(pending.key) as { payload: CreateTournamentPayload; rules: CompetitionRules; policy: EligibilityPolicy; venueId: number | null };
        request.current = { key: pending.key, requestId: pending.requestId };
        return send(pending.key, requestId => createCompetition(saved.payload, saved.rules, requestId, saved.policy, saved.venueId));
    };
    const restart = () => { clearDrawDraft(key); setDraft(freshDraft(seed, ageHint)); };
    return { draft, update, updateRules, updatePolicy, organisations, creatable, organizerId, hostClubs, sending, pending: Boolean(pending), create, recover, restart };
}
