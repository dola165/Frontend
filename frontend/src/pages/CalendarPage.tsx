import { scheduleMonthEntries } from '../components/schedule/segments';
import { JourneyEventDetails } from '../features/mapPlanning/JourneySchedule';
import { mergeJourneyEntries, useJourneyEntries, type JourneyEntry } from '../features/mapPlanning/journeyScheduleData';
import { FamilySchedule } from '../features/parents/FamilySchedule';
import { scheduleDestination } from '../features/schedule/origin';
import * as squadApi from '../features/squadCommunication/api';
import { useSquadSchedule, type SquadCalendarEvent } from '../features/squadCommunication/useSquadSchedule';
import { SquadSessionDetails } from '../features/squadCommunication/SquadSessionDialog';
import { useAuth } from '../context/AuthContext';
import '../features/squadCommunication/squad-schedule.css';
import { formatDate } from '../utils/formatting';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    EventCreationModal,
    type EventCreationFormValues,
    type ModalSurface,
} from '../components/schedule/EventCreationModal';
import { PastEventModal } from '../components/schedule/PastEventModal';
import { ScheduleGrid } from '../components/schedule/ScheduleGrid';
import { ScheduleToolbar } from '../components/schedule/ScheduleToolbar';
import { ScheduleDirectionWorkspace } from '../components/schedule/ScheduleDirectionWorkspace';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import { ScheduleEventDetails } from '../components/schedule/ScheduleEventDetails';
import { useMobileSchedule } from '../components/schedule/useMobileSchedule';
import { CalendarTutorial, isTutorialCompleted } from '../components/schedule/CalendarTutorial';
import {
    EVENT_TYPES,
    type Notice,
    type NoticeTone,
    type PublicationState,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface,
    type WorkspaceView,
} from '../components/schedule/workspaceTypes';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { canManageClubOperations, isLeadershipRole, type ClubMembershipContext } from '../features/clubs/domain';
import {
    createClubEvent,
    createMyEvent,
    fetchClubSchedule,
    fetchMySchedule,
    updateScheduleEvent,
    type DayOfWeek,
    type ScheduleEventOccurrence,
    type ScheduleEventType,
    type ScheduleEventUpsertInput,
} from '../features/schedule/api';
import { extractApiErrorMessage } from '../utils/apiError';
import { NotificationTarget } from '../components/notifications/NotificationTarget';
import { useAndroidUnsavedChanges } from '../android/useAndroidUnsavedChanges';

interface CalendarPageProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
}

type SEvent = ScheduleWorkspaceEvent;

const durationByType: Record<ScheduleEventType, number> = {
    TRAINING: 90,
    TRYOUT: 120,
    MATCH: 120,
    FRIENDLY: 120,
    ACTIVITY: 75,
};
const dayVals: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const recOrder: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const p2 = (v: number) => String(v).padStart(2, '0');
const cDate = (v: Date) => new Date(v.getTime());
const dk = (v: Date) => `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
const inpDate = (v: Date) => dk(v);
const inpTime = (v: Date) => `${p2(v.getHours())}:${p2(v.getMinutes())}`;
const inpDt = (v: Date) => `${inpDate(v)}T${inpTime(v)}`;
const apiDt = (v: Date) => `${inpDate(v)}T${inpTime(v)}:00`;
const normTime = (v: string) => (v.length >= 5 ? v.slice(0, 5) : v);
const parseD = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date() : d;
};
const isPastEvent = (v: string) => parseD(v).getTime() < Date.now();
const fmtEnum = (v: string) =>
    v
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
const sod = (v: Date) => {
    const d = cDate(v);
    d.setHours(0, 0, 0, 0);
    return d;
};
const sow = (v: Date) => {
    const d = sod(v);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
};
const som = (v: Date) => {
    const d = sod(v);
    d.setDate(1);
    return d;
};
const eom = (v: Date) => {
    const d = som(v);
    d.setMonth(d.getMonth() + 1);
    d.setMilliseconds(-1);
    return d;
};
const addD = (v: Date, n: number) => {
    const d = cDate(v);
    d.setDate(d.getDate() + n);
    return d;
};
const addM = (v: Date, n: number) => {
    const d = cDate(v);
    d.setMinutes(d.getMinutes() + n);
    return d;
};
const vrng = (vm: WorkspaceView, cd: Date) => {
    if (vm === 'month') return { s: som(cd), e: eom(cd) };
    if (vm === 'day') return { s: sod(cd), e: addM(addD(sod(cd), 1), -1) };
    const s = sow(cd);
    return { s, e: addM(addD(s, 7), -1) };
};
const ix = (ev: SEvent, rs: Date, re: Date) => {
    const es = parseD(ev.startsAt),
        ee = parseD(ev.endsAt);
    return es <= re && ee >= rs;
};
const fmtRange = (vm: WorkspaceView, cd: Date) => {
    if (vm === 'month') return formatDate(cd, { month: 'long', year: 'numeric' });
    if (vm === 'day') return formatDate(cd, { weekday: 'long', month: 'long', day: 'numeric' });
    const ws = sow(cd),
        we = addD(ws, 6);
    if (ws.getMonth() === we.getMonth())
        return `${formatDate(ws, { month: 'long' })} ${ws.getDate()} – ${we.getDate()}, ${we.getFullYear()}`;
    return `${formatDate(ws, { month: 'short', day: 'numeric' })} – ${formatDate(we, { month: 'short', day: 'numeric', year: 'numeric' })}`;
};
const step = (vm: WorkspaceView, cd: Date, delta: number) => {
    const d = cDate(cd);
    if (vm === 'month') {
        d.setMonth(d.getMonth() + delta);
        return d;
    }
    if (vm === 'week') {
        d.setDate(d.getDate() + delta * 7);
        return d;
    }
    d.setDate(d.getDate() + delta);
    return d;
};
const isPub = (e: SEvent) => e.visibility === 'PUBLIC' || e.visibility === 'SCHEDULED_PUBLICATION';
const gDow = (v: Date) => dayVals[v.getDay()];
const normAnchor = (sf: WorkspaceSurface, a: Date) => {
    const d = cDate(a);
    if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(sf === 'CLUB_SCHEDULE' ? 18 : 9, 0, 0, 0);
    else d.setSeconds(0, 0);
    if (d.getTime() <= Date.now()) {
        const next = new Date();
        next.setMinutes(Math.floor(next.getMinutes() / 30) * 30 + 30, 0, 0);
        return next;
    }
    return d;
};
const toDVis = (ev: ScheduleEventOccurrence) =>
    ev.clubId != null && ev.visibility === 'PRIVATE' ? 'CLUB_ONLY' : ev.visibility;
const toWE = (ev: ScheduleEventOccurrence, owner: string): SEvent => {
    const vis = toDVis(ev) as SEvent['visibility'];
    const ps: PublicationState = ev.publicNow
        ? 'LIVE'
        : ev.visibility === 'SCHEDULED_PUBLICATION'
          ? 'QUEUED'
          : 'PRIVATE';
    const me =
        ev.clubId != null && (ev.eventType === 'TRYOUT' || ev.eventType === 'MATCH' || ev.eventType === 'FRIENDLY');
    return {
        id: ev.occurrenceId,
        eventId: ev.eventId,
        homeScore: ev.homeScore, awayScore: ev.awayScore, resultStatus: ev.resultStatus, matchExchangeId: ev.matchExchangeId, canRecordResult: ev.canRecordResult, resultClubId: ev.resultClubId,
        origin: ev.origin,
        originId: ev.originId,
        title: ev.title,
        subtitle: ev.opponentClubName ? `vs ${ev.opponentClubName}` : null,
        description: ev.description,
        eventType: ev.eventType,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        locationText: ev.locationName,
        locationLat: ev.locationLat,
        locationLng: ev.locationLng,
        status: fmtEnum(ev.status),
        visibility: vis,
        publicationState: ps,
        publishAt: ev.publishAt,
        recurring: ev.recurring,
        recurrence: ev.recurrence,
        recurrenceLabel: null,
        ownerLabel: owner,
        mapEligible: me,
        appearsOnMap: Boolean(ev.publicNow && me),
        opponentClubId: ev.opponentClubId,
        hostSquadId: ev.challengerSquadId,
        hostSquadName: ev.challengerSquadName,
        conflictingEventIds: ev.conflictingEventIds ?? [],
        conflict: null,
        challenge: null,
    };
};
const decoConflict = (per: SEvent[], club: SEvent[]) =>
    per.map<SEvent>((ev) => {
        if (!ev.conflictingEventIds.length) return { ...ev, conflict: null };
        const src =
            club.find(
                (c) =>
                    ev.conflictingEventIds.includes(c.eventId) &&
                    parseD(ev.startsAt) < parseD(c.endsAt) &&
                    parseD(ev.endsAt) > parseD(c.startsAt),
            ) ??
            club.find((c) => ev.conflictingEventIds.includes(c.eventId)) ??
            null;
        if (!src)
            return {
                ...ev,
                conflict: {
                    sourceEventId: '',
                    sourceTitle: 'Club schedule',
                    overlapMinutes: 0,
                    severity: 'warning',
                    explanation: 'Overlaps with club schedule.',
                },
            };
        const os = Math.max(parseD(ev.startsAt).getTime(), parseD(src.startsAt).getTime());
        const oe = Math.min(parseD(ev.endsAt).getTime(), parseD(src.endsAt).getTime());
        const om = Math.max(0, Math.round((oe - os) / 60000));
        const sev = om >= 45 ? ('critical' as const) : ('warning' as const);
        return {
            ...ev,
            conflict: {
                sourceEventId: src.id,
                sourceTitle: src.title,
                overlapMinutes: om,
                severity: sev,
                explanation: `Overlaps with ${src.title} for ${om} minutes.`,
            },
        };
    });

const toUpsert = (ev: SEvent): ScheduleEventUpsertInput => ({
    title: ev.title,
    description: ev.description,
    eventType: ev.eventType,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    visibility: ev.visibility === 'CLUB_ONLY' ? 'PRIVATE' : (ev.visibility as ScheduleEventUpsertInput['visibility']),
    publishAt: ev.publishAt ?? null,
    locationName: ev.locationText ?? null,
    locationLat: ev.locationLat ?? null,
    locationLng: ev.locationLng ?? null,
    opponentClubId: ev.opponentClubId ?? null,
    hostSquadId: ev.hostSquadId ?? null,
    recurrence:
        ev.recurring && ev.recurrence
            ? {
                  frequency: 'WEEKLY',
                  intervalValue: ev.recurrence.intervalValue ?? 1,
                  daysOfWeek: ev.recurrence.daysOfWeek,
                  startDate: ev.recurrence.startDate,
                  endDate: ev.recurrence.endDate ?? null,
                  startTime: ev.recurrence.startTime,
                  endTime: ev.recurrence.endTime,
                  timezone: ev.recurrence.timezone ?? 'UTC',
              }
            : null,
});

export const CalendarPage = (props: CalendarPageProps) => {
    const [params, setParams] = useSearchParams();
    const { sessionId } = useAuth();
    return <CalendarEntry key={sessionId} {...props} squadMode={params.get('scope') === 'squad' || params.get('scope') === 'club' || (params.has('clubId') && !params.has('eventId') && params.get('scope') !== 'personal')}
        requestedClub={Number(params.get('clubId')) || undefined} requestedSquad={Number(params.get('squadId')) || undefined} onSquadChange={id => setParams({ scope: 'squad', squadId: String(id) }, { replace: true })}/>;
};
function CalendarEntry(props: CalendarPageProps & { squadMode: boolean; requestedClub?: number; requestedSquad?: number; onSquadChange: (id: number) => void }) {
    const [squads, setSquads] = useState<squadApi.SquadSpace[]>([]), [error, setError] = useState('');
    useEffect(() => {
        const abort = new AbortController();
        const load = () => { void squadApi.spaces(abort.signal).then(rows => { if (!abort.signal.aborted) { setSquads(rows); setError(''); } }).catch(error => {
            if (!abort.signal.aborted) { setSquads([]); setError(extractApiErrorMessage(error, 'Your squads could not load.')); }
        }); };
        load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { abort.abort(); clearInterval(timer); };
    }, []);
    return props.squadMode ? <div className="squad-calendar-page">{error && <p role="alert">{error}</p>}<FamilySchedule key={props.requestedSquad ?? 'first'} squads={props.requestedClub ? squads.filter(squad => squad.club_id === props.requestedClub) : squads} initialSquadId={props.requestedSquad} onSquadChange={props.onSquadChange}/></div>
        : <PersonalCalendarPage {...props} squads={squads} squadError={error}/>;
}
const PersonalCalendarPage = (props: CalendarPageProps & { squads: squadApi.SquadSpace[]; squadError: string }) => {
    void props; // Props kept for API symmetry — the page reads auth via context.
    const navigate = useNavigate();
    const mobile = useMobileSchedule();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedPersonalSchedule = true;
    const [ctx, setCtx] = useState<ClubMembershipContext | null>(null);
    const [ctxOk, setCtxOk] = useState(false);
    const [booted, setBooted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadN, setLoadN] = useState<string | null>(null);
    const [actN, setActN] = useState<Notice | null>(null);
    const [surface, setSurface] = useState<WorkspaceSurface>('MY_SCHEDULE');
    const [vm, setVm] = useState<WorkspaceView>('week');
    const [cursor, setCursor] = useState(() => {
        const requested = searchParams.get('date');
        const parsed =
            requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? new Date(`${requested}T12:00:00`) : new Date();
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    });
    const [etypes, setEtypes] = useState<ScheduleEventType[]>(EVENT_TYPES);
    const [pubOnly, setPubOnly] = useState(false);
    const [clubEv, setClubEv] = useState<SEvent[]>([]);
    const [perRaw, setPerRaw] = useState<SEvent[]>([]);
    const [rk, setRk] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const [pastEvent, setPastEvent] = useState<SEvent | null>(null);
    const [readEvent, setReadEvent] = useState<SEvent | null>(null);
    const [localOverrides, setLocalOverrides] = useState<Map<number, { startsAt: string; endsAt: string }>>(new Map());

    const [modal, setModal] = useState(false);
    useAndroidUnsavedChanges(modal);
    const [mmode, setMmode] = useState<'create' | 'edit'>('create');
    const [mvals, setMvals] = useState<EventCreationFormValues>(emptyForm());
    const [eid, setEid] = useState<number | null>(null);
    // Edit-target metadata the form values don't carry: owning club + original start (cancel gating).
    const [editMeta, setEditMeta] = useState<{ clubId: number | null; startsAt: string } | null>(null);
    const occClubById = useRef(new Map<string, number | null>());
    // Reuse the already-loaded surrounding days during quick date/view changes.
    // Scoped to this page/club, short lived, and invalidated by every mutation.
    const loadedWindow = useRef<{
        clubId: number | null;
        revision: number;
        from: number;
        to: number;
        loadedAt: number;
    } | null>(null);

    const [showTutorial, setShowTutorial] = useState(false);
    useEffect(() => {
        if (!ctxOk) return;
        if (!isTutorialCompleted()) setShowTutorial(true);
    }, [ctxOk]);

    useEffect(() => {
        let a = true;
        (async () => {
            try {
                const c = await fetchMyClubMembershipContext();
                if (!a) return;
                setCtx(c);
                setSurface(
                    !requestedPersonalSchedule && c?.clubId && canManageClubOperations(c?.myRole)
                        ? 'CLUB_SCHEDULE'
                        : 'MY_SCHEDULE',
                );
            } catch (e) {
                if (a) {
                    setCtx(null);
                    setSurface('MY_SCHEDULE');
                    setLoadN(extractApiErrorMessage(e, 'Membership unavailable.'));
                }
            } finally {
                if (a) setCtxOk(true);
            }
        })();
        return () => {
            a = false;
        };
    }, [requestedPersonalSchedule]);

    const canClub = Boolean(ctx?.clubId);
    const canMgmt = canManageClubOperations(ctx?.myRole);
    // Schedule-management gate for the cancel endpoint: viewer is OWNER/CLUB_ADMIN of the viewed club.
    const canManageSchedule = canClub && isLeadershipRole(ctx?.myRole);
    const clubLbl = ctx?.clubName ?? 'Club Schedule';
    const vr = useMemo(() => vrng(vm, cursor), [cursor, vm]);
    const rw = useMemo(() => {
        const pd = vm === 'month' ? 14 : vm === 'week' ? 7 : 2;
        return { from: addD(vr.s, -pd), to: addD(vr.e, pd) };
    }, [vm, vr]);

    useEffect(() => {
        if (!ctxOk) return;
        const cached = loadedWindow.current;
        if (
            cached &&
            cached.clubId === (ctx?.clubId ?? null) &&
            cached.revision === rk &&
            cached.from <= vr.s.getTime() &&
            cached.to >= vr.e.getTime() &&
            Date.now() - cached.loadedAt < 30_000
        ) {
            setBusy(false);
            return;
        }
        let a = true;
        const controller = new AbortController();
        (async () => {
            setBusy(true);
            try {
                const from = apiDt(rw.from),
                    to = apiDt(rw.to);
                const [per, clb] = await Promise.all([
                    fetchMySchedule(from, to, controller.signal),
                    ctx?.clubId ? fetchClubSchedule(ctx.clubId, from, to, controller.signal) : Promise.resolve([]),
                ]);
                if (!a) return;
                occClubById.current = new Map([...per, ...clb].map((e) => [e.occurrenceId, e.clubId]));
                setClubEv(clb.map((e) => toWE(e, clubLbl)));
                setPerRaw(per.map((e) => toWE(e, 'Visible only to you')));
                loadedWindow.current = {
                    clubId: ctx?.clubId ?? null,
                    revision: rk,
                    from: rw.from.getTime(),
                    to: rw.to.getTime(),
                    loadedAt: Date.now(),
                };
                setLoadN(null);
            } catch (e) {
                if (a) {
                    loadedWindow.current = null;
                    setLoadN(extractApiErrorMessage(e, 'Schedule load failed.'));
                    setClubEv([]);
                    setPerRaw([]);
                }
            } finally {
                if (a) {
                    setBusy(false);
                    setBooted(true);
                }
            }
        })();
        return () => {
            a = false;
            controller.abort();
        };
    }, [clubLbl, ctx?.clubId, ctxOk, rk, rw.from, rw.to, vr.s, vr.e]);

    const journeyData = useJourneyEntries(rw.from.toISOString(),rw.to.toISOString(),rk);
    const [journeyDetails,setJourneyDetails] = useState<JourneyEntry[] | null>(null);
    const squadData = useSquadSchedule(props.squads, apiDt(rw.from), apiDt(rw.to), rk);
    const [squadEventId, setSquadEventId] = useState<string | null>(null);
    const squadEvent = squadData.events.find(event => event.id === squadEventId);
    const personal = useMemo(() => {
        const shared = new Map([...perRaw, ...squadData.events].map(event => [event.id, event]));
        return decoConflict([...shared.values()], clubEv);
    }, [clubEv, perRaw, squadData.events]);
    const active = useMemo(()=>mergeJourneyEntries(surface === 'CLUB_SCHEDULE' ? clubEv : personal, journeyData.entries.filter(e=>surface !== 'CLUB_SCHEDULE'||e.clubId===ctx?.clubId)),[surface,clubEv,personal,journeyData.entries,ctx?.clubId]);
    const requestedJourney=searchParams.get('journey'),requestedJourneyChild=searchParams.get('journeyChild');
    const linkedJourney=journeyData.entries.find(e=>String(e.planId)===requestedJourney&&(!requestedJourneyChild||e.subjects.some(s=>String(s.id)===requestedJourneyChild)));
    const closeJourney=()=>{setJourneyDetails(null);if(requestedJourney){const next=new URLSearchParams(searchParams);next.delete('journey');next.delete('journeyChild');setSearchParams(next,{replace:true});}};

    const filtered = useMemo(
        () =>
            active
                .filter((e) => etypes.includes(e.eventType))
                .filter((e) => ix(e, vr.s, vr.e))
                .filter((e) => (surface === 'CLUB_SCHEDULE' ? !pubOnly || isPub(e) : true))
                .map((e) => {
                    const ov = localOverrides.get(e.eventId);
                    return ov ? { ...e, startsAt: ov.startsAt, endsAt: ov.endsAt } : e;
                })
                .sort((a, b) => parseD(a.startsAt).getTime() - parseD(b.startsAt).getTime()),
        [active, etypes, pubOnly, vr, surface, localOverrides],
    );

    const squadNamesById = useMemo(
        () =>
            active.reduce<Record<number, string>>((names, event) => {
                if (event.hostSquadId != null)
                    names[event.hostSquadId] = event.hostSquadName || `Squad ${event.hostSquadId}`;
                return names;
            }, {}),
        [active],
    );

    const weekDays = useMemo(
        () => (vm === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addD(sow(cursor), i))),
        [cursor, vm],
    );
    const canCreate = surface === 'MY_SCHEDULE' || canMgmt;



    const openCreate = (anchor?: Date, ptype?: ScheduleEventType, weekly = false) => {
        if (!canCreate) return;
        const s = normAnchor(surface, anchor ?? cursor);
        const et = ptype ?? (surface === 'CLUB_SCHEDULE' ? 'TRAINING' : 'ACTIVITY');
        const end = addM(s, durationByType[et]);
        setMmode('create');
        setEid(null);
        setEditMeta(null);
        setMvals({
            eventType: et,
            title: '',
            date: inpDate(s),
            startTime: inpTime(s),
            endTime: inpTime(end),
            isRecurring: weekly,
            locationName: '',
            locationLat: '',
            locationLng: '',
            visibility: 'PRIVATE',
            publishAt: '',
            ...(weekly
                ? {
                      recurrenceDays: [gDow(s)],
                      recurrenceStartDate: inpDate(s),
                      recurrenceEndDate: '',
                      recurrenceStartTime: inpTime(s),
                      recurrenceEndTime: inpTime(end),
                      recurrenceInterval: 1,
                  }
                : {}),
        });
        setModal(true);
    };

    const newEventRequested = searchParams.get('newEvent') === '1';
    useEffect(() => {
        if (!ctxOk || !canCreate || !newEventRequested) return;
        const start = normAnchor(surface, cursor);
        const eventType: ScheduleEventType = surface === 'CLUB_SCHEDULE' ? 'TRAINING' : 'ACTIVITY';
        const end = addM(start, durationByType[eventType]);
        setMmode('create');
        setEid(null);
        setEditMeta(null);
        setMvals({
            eventType,
            title: '',
            date: inpDate(start),
            startTime: inpTime(start),
            endTime: inpTime(end),
            isRecurring: false,
            locationName: '',
            locationLat: '',
            locationLng: '',
            visibility: 'PRIVATE',
            publishAt: '',
        });
        setModal(true);
        const next = new URLSearchParams(searchParams);
        next.delete('newEvent');
        setSearchParams(next, { replace: true });
    }, [canCreate, ctxOk, cursor, newEventRequested, searchParams, setSearchParams, surface]);

    const openEdit = (event: SEvent) => {
        if(event.journeys?.length){setJourneyDetails(event.journeys);return;}
        const destination = scheduleDestination(event);
        if (destination) { navigate(destination); return; }
        if (event.id.startsWith('tournament-referee:')) { navigate('/referees/me'); return; }
        if (squadData.events.some(item => item.id === event.id)) { setSquadEventId(event.id); return; }
        if (occClubById.current.get(event.id) != null) { setReadEvent(event); return; }
        // Past-event guard backstop: the past is read-only, never editable.
        if (isPastEvent(event.startsAt)) {
            setPastEvent(event);
            return;
        }
        if (!canCreate) {
            setReadEvent(event);
            return;
        }
        const s = parseD(event.startsAt),
            e = parseD(event.endsAt);
        const rc = event.recurrence;
        setMmode('edit');
        setEid(event.eventId);
        setEditMeta({ clubId: occClubById.current.get(event.id) ?? null, startsAt: event.startsAt });
        setMvals({
            eventType: event.eventType,
            title: event.title,
            date: inpDate(s),
            startTime: inpTime(s),
            endTime: inpTime(e),
            isRecurring: Boolean(rc),
            locationName: event.locationText ?? '',
            locationLat: event.locationLat != null ? String(event.locationLat) : '',
            locationLng: event.locationLng != null ? String(event.locationLng) : '',
            visibility: event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility,
            publishAt: event.publishAt ? inpDt(parseD(event.publishAt)) : '',
            description: event.description ?? '',
            hostSquadId: event.hostSquadId ?? null,
            opponentClubId: event.opponentClubId ?? null,
            recurrenceDays: rc ? recOrder.filter((d) => rc.daysOfWeek.includes(d)) : [gDow(s)],
            recurrenceStartDate: rc?.startDate ?? inpDate(s),
            recurrenceEndDate: rc?.endDate ?? '',
            recurrenceStartTime: rc ? normTime(rc.startTime) : inpTime(s),
            recurrenceEndTime: rc ? normTime(rc.endTime) : inpTime(e),
            recurrenceInterval: rc?.intervalValue,
            recurrenceTimezone: rc?.timezone,
        });
        setModal(true);
    };

    const handleSubmit = async (
        payload: ScheduleEventUpsertInput,
        meta: { eventType: ScheduleEventType; recurring: boolean },
    ) => {
        if (!etypes.includes(meta.eventType)) setEtypes((p) => [...p, meta.eventType]);
        if (mmode === 'create') {
            if (surface === 'CLUB_SCHEDULE') {
                if (!ctx?.clubId) throw new Error('No club context.');
                await createClubEvent(ctx.clubId, payload);
                setActN({
                    tone: 'success',
                    message: meta.recurring ? 'Weekly training added to your club calendar.' : 'Club event saved.',
                });
            } else {
                const r = await createMyEvent(payload);
                setActN({
                    tone: r.conflict ? 'warning' : 'success',
                    message: r.conflict ? 'Personal event saved with conflict warning.' : 'Personal event saved.',
                });
            }
        } else {
            await updateScheduleEvent(eid ?? 0, payload);
            setActN({ tone: 'success', message: 'Event updated.' });
        }
        setCursor(parseD(payload.startsAt));
        setPubOnly(false);
        setModal(false);
        setRk((k) => k + 1);
    };

    const handleEventDragEnd = async (eventId: number, newStartsAt: string, newEndsAt: string) => {
        const event = filtered.find((e) => e.eventId === eventId);
        if (event && scheduleDestination(event)) { openEdit(event); return; }
        if (!event || event.id.startsWith('tournament-referee:') || squadData.events.some(item => item.eventId === eventId) || occClubById.current.get(event.id) != null) return;

        // The API edits the whole series; it has no single-session move operation.
        // Open its schedule so a drag can never silently rewrite the recurring plan.
        if (event.recurring) {
            openEdit(event);
            setEditMode(false);
            return;
        }

        // Optimistic update
        setLocalOverrides((prev) => {
            const next = new Map(prev);
            next.set(eventId, { startsAt: newStartsAt, endsAt: newEndsAt });
            return next;
        });

        try {
            const payload = toUpsert(event);
            payload.startsAt = newStartsAt;
            payload.endsAt = newEndsAt;
            await updateScheduleEvent(eventId, payload);
            setActN({ tone: 'success', message: 'Event time updated.' });
            // Clear override and re-fetch
            setLocalOverrides(new Map());
            setRk((k) => k + 1);
        } catch (error) {
            // Revert optimistic update
            setLocalOverrides((prev) => {
                const next = new Map(prev);
                next.delete(eventId);
                return next;
            });
            setActN({
                tone: 'error',
                message: extractApiErrorMessage(error, 'Could not update event time.'),
            });
        }
    };

    if (!booted && (busy || !ctxOk)) {
        return (
            <div
                className="flex h-full min-h-0 items-center justify-center"
                style={{ backgroundColor: 'var(--fc-page-bg)' }}
            >
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[var(--fc-accent)]" />
                    <p className="text-xs font-semibold text-[var(--fc-text-secondary)]">Loading Schedule</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="schedule-bounded-workspace mx-auto flex h-full w-full min-h-0 max-w-[var(--app-page-max-width)] flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--fc-page-bg)', color: 'var(--fc-text-primary)' }}
        >
            {searchParams.has('eventId') && (
                <NotificationTarget
                    kind="event"
                    id={searchParams.get('eventId') ?? ''}
                    onClose={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete('eventId');
                        setSearchParams(next);
                    }}
                />
            )}
            {(journeyDetails||linkedJourney)&&<JourneyEventDetails entries={journeyDetails??[linkedJourney!]} onClose={closeJourney} onSaved={()=>setRk(n=>n+1)}/>}
            <ScheduleDirectionWorkspace
                hideInspector={Boolean(journeyDetails||linkedJourney)}
                extraActions={<MatchHistoryLink clubId={surface === 'CLUB_SCHEDULE' ? ctx?.clubId : undefined} className="schedule-direction-help" />}
                surface={surface}
                description="Your private plans and your squad commitments, together."
                backLabel="Back to home"
                clubName={clubLbl}
                canOpenClub
                canCreate={canCreate}
                mobile={mobile}
                busy={busy}
                date={cursor}
                days={weekDays}
                view={vm}
                rangeLabel={fmtRange(vm, cursor)}
                events={filtered}
                squadNamesById={squadNamesById}
                eventTypes={etypes}
                publicOnly={pubOnly}
                onSurface={next => { if (next === 'CLUB_SCHEDULE') navigate('/calendar?scope=squad'); }}
                onView={setVm}
                onDate={setCursor}
                onPrevious={() => setCursor((date) => step(vm, date, -1))}
                onNext={() => setCursor((date) => step(vm, date, 1))}
                onToday={() => setCursor(new Date())}
                onBack={() => navigate('/feed')}
                onHelp={() => {
                    localStorage.removeItem('tutorial.calendar.completed');
                    setShowTutorial(true);
                }}
                onCreate={openCreate}
                onCreateTraining={() => openCreate(undefined, 'TRAINING', true)}
                onSelect={openEdit}
                onTypes={setEtypes}
                onPublicOnly={() => setPubOnly((value) => !value)}
                notices={
                    <>
                        {actN && <NoticeBanner notice={actN} />}
                        {(squadData.error || props.squadError) && <NoticeBanner notice={{ tone: 'warning', message: squadData.error || props.squadError }} />}
                        {journeyData.error && <NoticeBanner notice={{tone:'warning',message:journeyData.error}}/>}
                        {loadN && <NoticeBanner notice={{ tone: 'warning', message: loadN }} />}
                    </>
                }
                calendarContent={(visibleEvents) => (
                    <div className="schedule-direction-calendar">
                        <ScheduleToolbar
                            workspaceLabel={surface === 'CLUB_SCHEDULE' ? clubLbl : 'My schedule'}
                            rangeLabel={fmtRange(vm, cursor)}
                            viewMode={vm}
                            stats={[]}
                            scheduleBusy={busy}
                            onViewModeChange={setVm}
                            editMode={!mobile && editMode && !filtered.some(e => e.journeys?.length || squadData.events.some(s => s.id === e.id) || occClubById.current.get(e.id) != null)}
                            onToggleEditMode={() => setEditMode((value) => !value)}
                            canEdit={canCreate && !mobile && !filtered.some(e => e.journeys?.length || e.id.startsWith('tournament-referee:') || squadData.events.some(s => s.id === e.id) || occClubById.current.get(e.id) != null)}
                        />
                        <div className="schedule-direction-calendar-grid">
                            <ScheduleGrid
                                viewMode={vm}
                                cursorDate={cursor}
                                monthEvents={scheduleMonthEntries(visibleEvents)}
                                days={weekDays}
                                events={visibleEvents}
                                onSelectDate={setCursor}
                                onEditEvent={openEdit}
                                onOpenPastEvent={openEdit}
                                canCreate={canCreate}
                                onCreateAt={(day) => openCreate(day)}
                                editMode={!mobile && editMode && !filtered.some(e => e.journeys?.length || squadData.events.some(s => s.id === e.id) || occClubById.current.get(e.id) != null)}
                                onEventDragEnd={handleEventDragEnd}
                            />
                        </div>
                    </div>
                )}
            />

            {modal && (
                <EventCreationModal
                    isOpen
                    mode={mmode}
                    surface={surface as ModalSurface}
                    initialValues={mvals}
                    clubId={ctx?.clubId ?? null}
                    targetEventId={eid ?? undefined}
                    canManageSchedule={canManageSchedule}
                    targetEventClubId={editMeta?.clubId ?? null}
                    targetEventStartsAt={editMeta?.startsAt ?? null}
                    onCancelled={() => setRk((k) => k + 1)}
                    subjectLabel={surface === 'CLUB_SCHEDULE' ? clubLbl : 'Visible only to you'}
                    onClose={() => setModal(false)}
                    onSubmit={handleSubmit}
                />
            )}

            {pastEvent && (
                <PastEventModal
                    event={pastEvent}
                    clubId={surface === 'CLUB_SCHEDULE' ? (ctx?.clubId ?? null) : null}
                    clubName={clubLbl}
                    canComplete={canMgmt}
                    canRecordResult={canManageSchedule}
                    onClose={() => setPastEvent(null)}
                    onCompleted={() => {
                        setPastEvent(null);
                        setRk((k) => k + 1);
                    }}
                />
            )}

            {squadEvent && <SquadSessionDetails event={squadEvent as SquadCalendarEvent} onClose={() => setSquadEventId(null)} onSaved={() => setRk(k => k + 1)}/>}
            {readEvent && <ScheduleEventDetails event={readEvent} onClose={() => setReadEvent(null)} />}
            {showTutorial && !mobile && !journeyDetails && !linkedJourney && (
                <CalendarTutorial canCreate={canCreate} onComplete={() => setShowTutorial(false)} />
            )}
        </div>
    );
};

function emptyForm(): EventCreationFormValues {
    return {
        eventType: null,
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        isRecurring: false,
        locationName: '',
        locationLat: '',
        locationLng: '',
        visibility: 'PRIVATE',
        publishAt: '',
    };
}

const ns: Record<NoticeTone, CSSProperties> = {
    success: { borderColor: 'var(--fc-accent)', backgroundColor: 'var(--fc-accent-soft)', color: 'var(--fc-accent)' },
    warning: {
        borderColor: 'var(--fc-state-warning)',
        backgroundColor: 'color-mix(in srgb, var(--color-orange) 10%, transparent)',
        color: 'var(--fc-state-warning)',
    },
    error: {
        borderColor: 'var(--fc-state-danger)',
        backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
        color: 'var(--fc-state-danger)',
    },
};

const NoticeBanner = ({ notice }: { notice: Notice }) => (
    <div className="border-b border-[var(--fc-border)] px-4 py-2.5">
        <div
            className="flex items-start gap-2.5 rounded-[var(--fc-radius)] border px-3 py-2.5 text-sm"
            style={ns[notice.tone]}
        >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice.message}</span>
        </div>
    </div>
);
