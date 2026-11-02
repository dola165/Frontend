import { useNavigate, useSearchParams } from 'react-router-dom';
import { FamilySchedule } from '../../parents/FamilySchedule';
import { SquadTrainingSetup } from './SquadTrainingSetup';
import { useJourneyCopy } from '../journeyCopy';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type * as api from '../api';
import { get } from '../../matchExchange/api';
import { matchPath } from '../../matches/matchContext';
import { fetchSessionOccurrence } from '../sessionOccurrence';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';

const positive = (value: string | null) => { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : undefined; };

/**
 * The one calendar, fixed to this squad. Coaches plan and drag sessions (with the confirmation that names who is
 * told); a parent answers for their child inside a session. `session` and `at` in the address open one session.
 */
export function SquadScheduleTab({ space, childId }: { space: api.SquadOverview; childId?: number }) {
    const [params, setParams] = useSearchParams();
    const copy = useJourneyCopy();
    const [revision, setRevision] = useState(0), [saved, setSaved] = useState(false);
    const setup = space.can_manage && params.get('setup') === 'training';
    const closeSetup = (firstDate?: string) => { const next = new URLSearchParams(params); next.delete('setup'); if (firstDate) { next.set('at', firstDate); next.delete('session'); next.delete('sessionId'); } setParams(next, { replace: true }); };
    const sessionId = positive(params.get('session') ?? params.get('sessionId'));
    const navigate = useNavigate();
    const account = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [attempt, setAttempt] = useState(0);
    const lookupKey = `${account}:${space.id}:${sessionId}:${childId}:${attempt}`;
    const [lookup, setLookup] = useState<{ key: string; date?: string; error?: string } | null>(null);
    // A link sent before step 6 may name a session that became a match: it opens that match, in this squad's place
    // for its staff (fix round 1). Any other session opens here, in the calendar.
    useEffect(() => {
        if (!sessionId) return;
        const controller = new AbortController();
        void (async () => {
            try {
                const found = await get<{ eventId: number }>(`/match-arrangements/squads/${space.id}/sessions/${sessionId}`, undefined, controller.signal);
                if (found?.eventId) {
                    if (!controller.signal.aborted) navigate(matchPath(found.eventId, space.can_manage ? { kind: 'squad', id: space.id } : null), { replace: true });
                    return;
                }
            } catch (error) {
                if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
            }
            const found = await fetchSessionOccurrence(space.id, sessionId, space.can_manage ? undefined : childId, controller.signal);
            if (!controller.signal.aborted) setLookup({ key: lookupKey, date: found.session.starts_at });
        })().catch(error => { if (!controller.signal.aborted) setLookup({ key: lookupKey, error: extractApiErrorMessage(error, 'This event could not load. Try again.') }); });
        return () => controller.abort();
    }, [space.id, space.can_manage, sessionId, childId, navigate, lookupKey]);
    const current = lookup?.key === lookupKey ? lookup : null;
    const at = sessionId ? current?.date : params.get('at'), date = at && Number.isFinite(Date.parse(at)) ? new Date(at) : undefined;
    return <div className="sp-schedule">
        {saved && !setup && <p role="status" className="sp-quiet">{copy('Training saved. Family invitations are in the schedule.', 'ვარჯიში შენახულია. ოჯახების მოწვევები განრიგშია.')}</p>}
        {setup && <SquadTrainingSetup space={space} onClose={closeSetup} onSaved={firstDate => { closeSetup(firstDate); setSaved(true); setRevision(n => n + 1); toast.success(copy('Training saved', 'ვარჯიში შენახულია')); }} />}
        {sessionId && !current && <p role="status">Loading the current event…</p>}
        {current?.error && <p role="alert">{current.error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry event</button></p>}
        {(!sessionId || current?.date) && <FamilySchedule key={`${account}:${space.id}:${sessionId}:${at}:${revision}`} squads={[space]} playerId={space.can_manage ? undefined : childId}
            initialSquadId={space.id} initialSessionId={sessionId} initialDate={date} inSquadPage hideContext editable={space.can_manage} />
        }
    </div>;
}
