import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe2, LockKeyhole } from 'lucide-react';
import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, Field, FixtureRow, List, Panel, Section, Skeleton } from '../../../design/primitives';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { addDays, calendarTime, clockTime, dayDate, validTimezone, weekStart, type TrainingSession } from '../../clubs/trainingCalendar';
import './squads.css';
import '../club-workspace.css';

interface Timetable { squadId: number; squadName: string; visibility: 'PUBLIC' | 'PRIVATE'; canManage: boolean; canView: boolean; revision: number; sessions: TrainingSession[]; limited: boolean; programmeTimesPublic?: boolean; publicationConfigured?: boolean }
type Visibility = 'PUBLIC' | 'PRIVATE';
const root = (club: number, squad: number) => `/clubs/${club}/squads/${squad}/training-schedule`;
const dateLabel = (day: string, options: Intl.DateTimeFormatOptions) => dayDate(day).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });

/**
 * A squad's regular training, one week at a time, as fixture lines, with who can see it on the club profile.
 * Times are the squad's own clock. Changing visibility sends the timetable's revision, so a newer change is never overwritten.
 */
export function SquadTimetable({ clubId, squadId }: { clubId: number; squadId: number }) {
    const { sessionId, status } = useAuth();
    return <TimetableContent key={`${clubId}:${squadId}:${sessionId}:${status}`} clubId={clubId} squadId={squadId} />;
}

function TimetableContent({ clubId, squadId }: { clubId: number; squadId: number }) {
    const { sessionId } = useAuth();
    const [result, setResult] = useState<Timetable | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    const [week, setWeek] = useState<string | null>(null), [proposed, setProposed] = useState<Visibility | null>(null), [saving, setSaving] = useState(false);
    const alive = useRef(true), lock = useRef(false);
    useEffect(() => {
        alive.current = true;
        const controller = new AbortController();
        const load = () => void apiClient.get<Timetable>(root(clubId, squadId), { signal: controller.signal, _authSessionId: sessionId } as AuthSessionRequestConfig)
            .then(response => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) { setResult(response.data); setError(''); } })
            .catch(failure => { if (!controller.signal.aborted && isCurrentAuthSession(sessionId)) { setResult(null); setError(extractApiErrorMessage(failure, 'Training times could not load.')); } });
        load();
        const refresh = () => { if (!document.hidden) load(); };
        window.addEventListener('focus', refresh);
        return () => { alive.current = false; controller.abort(); window.removeEventListener('focus', refresh); };
    }, [clubId, squadId, sessionId, attempt]);

    const save = async () => {
        if (!result || !proposed || lock.current || !isCurrentAuthSession(sessionId)) return;
        lock.current = true; setSaving(true); setError('');
        try {
            await apiClient.put(`${root(clubId, squadId)}/publication`, { visibility: proposed, revision: result.revision }, { _authSessionId: sessionId } as AuthSessionRequestConfig);
            if (alive.current && isCurrentAuthSession(sessionId)) { setProposed(null); setAttempt(v => v + 1); }
        } catch (failure) { if (alive.current) setError(extractApiErrorMessage(failure, 'Could not update timetable visibility.')); }
        finally { lock.current = false; if (alive.current) setSaving(false); }
    };

    const zone = validTimezone(result?.sessions.find(s => s.timezone)?.timezone);
    const today = calendarTime(new Date().toISOString(), zone)!.day;
    const entries = (result?.sessions ?? []).map(session => ({ session, start: calendarTime(session.startsAt, zone), end: calendarTime(session.endsAt, zone) }))
        .filter((entry): entry is { session: TrainingSession; start: { day: string; minute: number }; end: { day: string; minute: number } } => Boolean(entry.start && entry.end))
        .sort((a, b) => a.start.day.localeCompare(b.start.day) || a.start.minute - b.start.minute);
    const firstWeek = weekStart(entries.find(e => e.start.day >= today && e.session.status !== 'CANCELLED')?.start.day ?? today);
    const shown = week ?? firstWeek;
    const minWeek = weekStart([today, ...entries.map(e => e.start.day)].sort()[0]);
    const maxWeek = weekStart([addDays(today, 42), ...entries.map(e => e.start.day)].sort().at(-1)!);
    const inWeek = entries.filter(e => e.start.day >= shown && e.start.day <= addDays(shown, 6));
    const thisWeek = shown === weekStart(today);
    const publicTimes = result && (result.visibility === 'PUBLIC' || result.programmeTimesPublic);
    const current: Visibility | 'AUTOMATIC' = result?.programmeTimesPublic && !result.publicationConfigured ? 'AUTOMATIC' : result?.visibility ?? 'PRIVATE';
    const changing = proposed !== null && (proposed !== result?.visibility || (!result?.publicationConfigured && result?.programmeTimesPublic));

    let body;
    if (error && !result) body = <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => setAttempt(v => v + 1)}>Try again</Button></div>;
    else if (!result) body = <Panel><div className="cw-skeleton-rows" role="status" aria-label="Loading training times">{[0, 1, 2].map(i => <Skeleton key={i} height={48} />)}</div></Panel>;
    else if (!result.canView) body = <Panel><EmptyNote title="This timetable is shared with squad members">The club has not published training times for this group.</EmptyNote></Panel>;
    else body = <Panel flush>
        <div className="sq-week">
            <Button size="sm" variant="ghost" iconOnly aria-label="Previous week" disabled={shown <= minWeek} onClick={() => setWeek(addDays(shown, -7))}><ChevronLeft aria-hidden="true" /></Button>
            <strong aria-live="polite">{thisWeek ? 'This week' : `Week of ${dateLabel(shown, { day: 'numeric', month: 'short' })}`}</strong>
            <Button size="sm" variant="ghost" iconOnly aria-label="Next week" disabled={shown >= maxWeek} onClick={() => setWeek(addDays(shown, 7))}><ChevronRight aria-hidden="true" /></Button>
            {!thisWeek && <Button size="sm" variant="ghost" onClick={() => setWeek(weekStart(today))}>Today</Button>}
        </div>
        {inWeek.length ? <List label={`${result.squadName} training`}>{inWeek.map(({ session, start, end }) => <FixtureRow key={`${session.id}-${start.day}`} tone={session.status === 'CANCELLED' ? 'neutral' : 'training'}
            time={clockTime(start.minute)} day={start.day === today ? 'Today' : dateLabel(start.day, { weekday: 'short', day: 'numeric' })}
            title={session.title} meta={[`Until ${clockTime(end.minute)}`, session.location].filter(Boolean).join(' · ')}
            trail={session.status === 'CANCELLED' ? <Badge tone="danger">Cancelled</Badge> : undefined} />)}</List>
            : <EmptyNote title="No training this week">Choose another week, or plan sessions in the calendar.</EmptyNote>}
        {result.limited && <p className="gk-panel__foot cw-muted">Only the first 200 sessions are shown.</p>}
    </Panel>;

    return <Section title="Weekly schedule" hint={result ? <span className="sq-visibility">{publicTimes ? <Globe2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{result.programmeTimesPublic ? 'Training times public' : result.visibility === 'PUBLIC' ? 'Public' : 'Squad members'}</span> : undefined}
        action={result?.canManage ? <ButtonLink size="sm" variant="ghost" to={`/calendar?scope=squad&squadId=${squadId}`}>Manage sessions</ButtonLink> : undefined}>
        {error && result && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        {body}
        {result?.canManage && <Panel flush><details className="rec-disclosure" open={proposed !== null || undefined}><summary>Who can see this timetable</summary>
            <div className="rec-disclosure__body gk-stack gk-stack--tight">
                <p className="cw-muted">Published programmes show training dates and times automatically. Titles and places stay with squad members unless you publish the full timetable. Player lists, replies and notes always stay private. Club events keep their own publication settings.</p>
                <Field label="Timetable visibility" htmlFor={`sq-visibility-${squadId}`}>
                    <select id={`sq-visibility-${squadId}`} className="gk-input" disabled={saving} value={proposed ?? current} onChange={event => setProposed(event.target.value as Visibility)}>
                        {current === 'AUTOMATIC' && <option value="AUTOMATIC" disabled>Programme dates and times (automatic)</option>}
                        <option value="PRIVATE">Squad members only</option><option value="PUBLIC">Everyone on the club profile</option>
                    </select>
                </Field>
                {changing && <>
                    <p className="gk-notice gk-notice--warning">{proposed === 'PUBLIC' ? 'Check the training titles and places above. Saving also publishes future training sessions added to this squad.' : 'Saving removes the timetable from the public club view. Squad members keep access.'}</p>
                    <div className="gk-row"><Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : proposed === 'PUBLIC' ? 'Publish training timetable' : 'Make timetable private'}</Button>
                        <Button variant="ghost" disabled={saving} onClick={() => setProposed(null)}>Cancel</Button></div>
                </>}
            </div>
        </details></Panel>}
    </Section>;
}
