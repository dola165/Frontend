import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import type { ScheduleEventOccurrence } from '../../../features/schedule/api';
import { appLocale } from '../../../utils/formatting';
import { MatchHistoryLink } from '../../../features/matchHistory/MatchHistoryLink';
import { ScheduleScore } from '../../../features/matchHistory/ScheduleResult';
import { useClubProfileSearchParams } from '../../../features/clubs/clubProfilePreviewContext';
import { SquadTrainingSchedule } from '../../../features/clubs/SquadTrainingSchedule';
import '../club-profile-refinement.css';

type ClubOccurrence = Omit<ScheduleEventOccurrence, 'eventType'> & { eventType: ScheduleEventOccurrence['eventType'] | 'MEETING' };
type Squad = { id: number; name: string };
const labels: Record<ClubOccurrence['eventType'], string> = {
    MATCH: 'Match', FRIENDLY: 'Friendly', TRAINING: 'Training', TRYOUT: 'Tryout', ACTIVITY: 'Club activity', MEETING: 'Meeting',
};
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
const time = (value: string) => new Date(value).toLocaleString(appLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const ClubActivityList = ({ clubId, isOwnClubAdmin, view }: { clubId: number; isOwnClubAdmin: boolean; view: 'schedule' | 'events' }) => {
    const [params, setParams] = useClubProfileSearchParams();
    const [data, setData] = useState<{ clubId: number; items: ClubOccurrence[]; squads: Squad[] } | null>(null);
    const [error, setError] = useState(false);
    const [retry, setRetry] = useState(0);
    const kind = params.get('kind') === 'training' ? 'training' : 'matches';
    const squad = params.get('squad') || 'all';
    const period = params.get('period') === 'recent' ? 'recent' : 'upcoming';
    const filter = (key: string, value: string) => {
        const next = new URLSearchParams(params); next.set(key, value);
        setParams(next, { replace: true });
    };
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now);
    const isSchedule = view === 'schedule';
    const squadTraining = isSchedule && kind === 'training' && /^[1-9]\d*$/.test(squad) && Number.isSafeInteger(Number(squad));

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const from = new Date(); from.setDate(from.getDate() - 30);
        const to = new Date(); to.setDate(to.getDate() + 90);
        // Reset request feedback before synchronizing the selected club.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError(false);
        Promise.all([
            apiClient.get<{ events: ClubOccurrence[] }>(`/schedule/clubs/${clubId}/events`, { params: { from: localDateTime(from), to: localDateTime(to) }, signal: controller.signal }),
            isSchedule ? apiClient.get<Squad[]>(`/clubs/${clubId}/squads`, { signal: controller.signal }) : Promise.resolve({ data: [] as Squad[] }),
        ]).then(([events, squads]) => {
            if (!controller.signal.aborted) setData({ clubId, items: events.data.events ?? [], squads: squads.data });
        }).catch(() => {
            if (!controller.signal.aborted) setError(true);
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [clubId, retry, isSchedule]);

    const items = data?.clubId === clubId ? data.items : [];
    const squads = data?.clubId === clubId ? data.squads : [];
    const filtered = items.filter(item => {
        const starts = new Date(item.startsAt).getTime();
        const ends = new Date(item.endsAt).getTime();
        if (!Number.isFinite(starts)) return false;
        const upcoming = (Number.isFinite(ends) ? ends : starts) >= now && item.status !== 'COMPLETED';
        const withdrawn = item.status === 'CANCELLED' || item.challengeStatus === 'REJECTED';
        if (period === 'upcoming' ? !upcoming || withdrawn : upcoming && !withdrawn) return false;
        if (!isSchedule) return ['MEETING', 'ACTIVITY', 'TRYOUT'].includes(item.eventType);
        if (kind === 'training' ? item.eventType !== 'TRAINING' : !['MATCH', 'FRIENDLY'].includes(item.eventType)) return false;
        const ownSquadId = item.clubId === clubId ? item.challengerSquadId : item.targetSquadId;
        // Assigned training is read through the same authorized timetable as the squad page.
        if (isSchedule && kind === 'training' && squad === 'all') return ownSquadId == null;
        return squad === 'all' || (squad === 'unassigned' ? ownSquadId == null : String(ownSquadId) === squad);
    }).sort((a, b) => (period === 'upcoming' ? 1 : -1) * (new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));

    return <section className="club-activity-panel rounded-2xl border border-[var(--club-theme-border-subtle)] bg-[var(--club-card)] text-[var(--club-theme-text-primary)]">
        <header className="border-b border-[var(--club-theme-border-subtle)] p-5">
            <h2 className="text-xl font-semibold">{isSchedule ? /^[1-9]\d*$/.test(squad) ? 'Squad schedule' : 'Schedule' : 'Events'}</h2>
            <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">{isSchedule
                ? 'Browse matches or the squad’s training timetable. Private sessions are visible only to people with access.'
                : 'Meetings, tryouts and club activities, including tournament participation. Match fixtures and training are in Schedule.'}</p>
            <div className="flex flex-wrap gap-2">
                {isSchedule && <MatchHistoryLink clubId={clubId} squadId={squad !== 'all' && squad !== 'unassigned' ? Number(squad) : undefined} className="club-activity-action mt-3 inline-flex items-center gap-2" />}
                {isOwnClubAdmin && <Link className="club-activity-action mt-3 inline-flex" to="/calendar">{isSchedule ? 'Manage schedule' : 'Plan a club activity'}</Link>}
                {!isSchedule && <Link className="club-activity-action mt-3 inline-flex" to={`/clubs/${clubId}?tab=business&opportunity=jobs`}>Ongoing roles →</Link>}
            </div>
        </header>
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--club-theme-border-subtle)] p-4">
            {isSchedule && <div className="flex gap-2" aria-label="Schedule content">
                <button className="club-activity-action" aria-pressed={kind === 'matches'} onClick={() => filter('kind', 'matches')}>Matches</button>
                <button className="club-activity-action" aria-pressed={kind === 'training'} onClick={() => filter('kind', 'training')}>Training</button>
            </div>}
            {isSchedule && <label className="grid gap-1 text-xs">Squad<select aria-label="Squad" className="club-activity-action" value={squad} onChange={e => filter('squad', e.target.value)}>
                <option value="all">All squads</option>{squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="unassigned">No squad assigned</option>
            </select></label>}
            {(!isSchedule || kind !== 'training' || squad === 'unassigned') && <label className="grid gap-1 text-xs">When<select aria-label="When" className="club-activity-action" value={period} onChange={e => filter('period', e.target.value)}>
                <option value="upcoming">Upcoming · next 90 days</option><option value="recent">Recent & cancelled · last 30 / next 90 days</option>
            </select></label>}
        </div>
        {squadTraining ? <div className="cp-schedule-timetable"><SquadTrainingSchedule clubId={clubId} squadId={Number(squad)}/></div> : <>
        {isSchedule && kind === 'training' && squad === 'all' && !loading && !error && <div className="cp-schedule-squads"><p>Choose a squad to see its training days and times.</p>{squads.map(s => <button className="cp-schedule-squad" key={s.id} onClick={() => filter('squad', String(s.id))}><CalendarDays size={18}/><span>{s.name}</span><span aria-hidden="true">→</span></button>)}</div>}
        {loading ? <p role="status" className="p-6">Loading {isSchedule ? 'schedule' : 'events'}…</p>
            : error ? <div role="alert" className="p-6"><p>Could not load {isSchedule ? 'the schedule' : 'events'}.</p><button className="club-activity-action mt-3" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
            : filtered.length === 0 ? isSchedule && kind === 'training' && squad === 'all' && squads.length ? null : <div className="p-8 text-center text-[var(--club-theme-text-secondary)]"><CalendarDays className="mx-auto mb-3 h-8 w-8" /><p>No {isSchedule ? kind === 'training' ? 'training sessions' : 'matches' : 'club events'} to show for these filters.</p></div>
            : <div className="divide-y divide-[var(--club-theme-border-subtle)]">{filtered.map(item => {
                const ownSquadName = item.clubId === clubId ? item.challengerSquadName : item.targetSquadName;
                return <article key={item.occurrenceId} className="p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--club-tone-blue)]"><time dateTime={item.startsAt}>{time(item.startsAt)}</time><span>– {time(item.endsAt)}</span><span>{labels[item.eventType]}</span></div>
                    <h3 className="mt-2 font-semibold">{item.title}</h3>
                    <ScheduleScore event={item} />
                    {['MATCH', 'FRIENDLY'].includes(item.eventType) && <Link className="club-activity-action mt-3 inline-flex" to={item.matchExchangeId ? `/match-exchange/${item.matchExchangeId}#result` : `/calendar?eventId=${item.eventId}`}>View match & result →</Link>}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--club-theme-text-secondary)]">
                        {ownSquadName && <span>{ownSquadName}</span>}
                        {item.eventType === 'TRAINING' && !ownSquadName && <span>No squad assigned</span>}
                        {item.opponentClubName && <span>vs {item.clubId === clubId ? item.opponentClubName : item.clubName}</span>}
                        {item.recurring && <span>Recurring training</span>}
                        <span>{item.publicNow ? 'Public' : 'Internal'}</span>
                        {item.status === 'CANCELLED' || item.status === 'COMPLETED' ? <span>{item.status === 'CANCELLED' ? 'Cancelled' : 'Completed'}</span> : null}
                        {item.challengeStatus === 'PENDING' && <span>Awaiting confirmation</span>}
                        {item.challengeStatus === 'REJECTED' && <span>Declined</span>}
                    </div>
                    {item.eventType === 'TRAINING' && item.recurrence && <p className="mt-2 text-xs text-[var(--club-theme-text-secondary)]">
                        {item.recurrence.intervalValue > 1 ? `Every ${item.recurrence.intervalValue} weeks` : 'Weekly'} · {item.recurrence.daysOfWeek.map(day => day.charAt(0) + day.slice(1).toLowerCase()).join(', ')} · {item.recurrence.startTime.slice(0, 5)}–{item.recurrence.endTime.slice(0, 5)} {item.recurrence.timezone}
                    </p>}
                    {item.locationName && <p className="mt-3 flex items-center gap-2 text-sm text-[var(--club-theme-text-secondary)]"><MapPin className="h-4 w-4 shrink-0 text-[var(--club-tone-green)]" />{item.locationName}</p>}
                    {item.description && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--club-theme-text-secondary)]">{item.description}</p>}
                </article>;
            })}</div>}</>}
    </section>;
};
