import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
    ArrowLeft,
    CalendarDays,
    Loader2,
    TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EventCreationModal, type EventCreationFormValues, type ModalSurface } from '../components/schedule/EventCreationModal';
import { ScheduleGrid } from '../components/schedule/ScheduleGrid';
import { ScheduleToolbar } from '../components/schedule/ScheduleToolbar';
import { ScheduleWorkspaceHeader } from '../components/schedule/ScheduleWorkspaceHeader';
import { StandingSchedule } from '../components/schedule/StandingSchedule';
import { CalendarTutorial, isTutorialCompleted } from '../components/schedule/CalendarTutorial';
import {
    EVENT_TYPES,
    eventTypeCopy,
    type Notice,
    type NoticeTone,
    type PublicationState,
    type ScheduleWorkspaceEvent,
    type WorkspaceSurface,
    type WorkspaceView
} from '../components/schedule/workspaceTypes';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { canManageClubOperations, type ClubMembershipContext } from '../features/clubs/domain';
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

interface CalendarPageProps {
    user: { id?: number; username?: string; fullName?: string; role?: string } | null;
    darkMode: boolean;
    setDarkMode: (value: boolean) => void;
}

type SEvent = ScheduleWorkspaceEvent;

const durationByType: Record<ScheduleEventType, number> = {
    TRAINING: 90, TRYOUT: 120, MATCH: 120, FRIENDLY: 120, ACTIVITY: 75
};
const DEFAULT_LEFT = 220, MIN_LEFT = 176, MAX_LEFT = 360, MIN_CTR = 480, RESIZER = 12;
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
const parseD = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? new Date() : d; };
const fmtEnum = (v: string) => v.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
const sod = (v: Date) => { const d = cDate(v); d.setHours(0, 0, 0, 0); return d; };
const sow = (v: Date) => { const d = sod(v); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const som = (v: Date) => { const d = sod(v); d.setDate(1); return d; };
const eom = (v: Date) => { const d = som(v); d.setMonth(d.getMonth() + 1); d.setMilliseconds(-1); return d; };
const addD = (v: Date, n: number) => { const d = cDate(v); d.setDate(d.getDate() + n); return d; };
const addM = (v: Date, n: number) => { const d = cDate(v); d.setMinutes(d.getMinutes() + n); return d; };
const vrng = (vm: WorkspaceView, cd: Date) => {
    if (vm === 'month') return { s: som(cd), e: eom(cd) };
    if (vm === 'day') return { s: sod(cd), e: addM(addD(sod(cd), 1), -1) };
    const s = sow(cd); return { s, e: addM(addD(s, 7), -1) };
};
const ix = (ev: SEvent, rs: Date, re: Date) => {
    const es = parseD(ev.startsAt), ee = parseD(ev.endsAt);
    return es <= re && ee >= rs;
};
const fmtRange = (vm: WorkspaceView, cd: Date) => {
    if (vm === 'month') return cd.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (vm === 'day') return cd.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const ws = sow(cd), we = addD(ws, 6);
    if (ws.getMonth() === we.getMonth()) return `${ws.toLocaleDateString(undefined, { month: 'long' })} ${ws.getDate()} – ${we.getDate()}, ${we.getFullYear()}`;
    return `${ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
};
const step = (vm: WorkspaceView, cd: Date, delta: number) => {
    const d = cDate(cd);
    if (vm === 'month') { d.setMonth(d.getMonth() + delta); return d; }
    if (vm === 'week') { d.setDate(d.getDate() + delta * 7); return d; }
    d.setDate(d.getDate() + delta); return d;
};
const isPub = (e: SEvent) => e.visibility === 'PUBLIC' || e.visibility === 'SCHEDULED_PUBLICATION';
const gDow = (v: Date) => dayVals[v.getDay()];
const normAnchor = (sf: WorkspaceSurface, a: Date) => {
    const d = cDate(a);
    if (d.getHours() === 0 && d.getMinutes() === 0) d.setHours(sf === 'CLUB_SCHEDULE' ? 18 : 9, 0, 0, 0);
    else d.setSeconds(0, 0);
    return d;
};
const toDVis = (ev: ScheduleEventOccurrence) =>
    ev.clubId != null && ev.visibility === 'PRIVATE' ? 'CLUB_ONLY' : ev.visibility;
const toWE = (ev: ScheduleEventOccurrence, owner: string): SEvent => {
    const vis = toDVis(ev) as SEvent['visibility'];
    const ps: PublicationState = ev.publicNow ? 'LIVE' : ev.visibility === 'SCHEDULED_PUBLICATION' ? 'QUEUED' : 'PRIVATE';
    const me = ev.clubId != null && (ev.eventType === 'TRYOUT' || ev.eventType === 'MATCH' || ev.eventType === 'FRIENDLY');
    return {
        id: ev.occurrenceId, eventId: ev.eventId, title: ev.title,
        subtitle: ev.opponentClubName ? `vs ${ev.opponentClubName}` : null,
        description: ev.description, eventType: ev.eventType,
        startsAt: ev.startsAt, endsAt: ev.endsAt,
        locationText: ev.locationName, locationLat: ev.locationLat, locationLng: ev.locationLng,
        status: fmtEnum(ev.status), visibility: vis, publicationState: ps,
        publishAt: ev.publishAt, recurring: ev.recurring, recurrence: ev.recurrence,
        recurrenceLabel: null, ownerLabel: owner,
        mapEligible: me, appearsOnMap: Boolean(ev.publicNow && me),
        opponentClubId: ev.opponentClubId, conflictingEventIds: ev.conflictingEventIds ?? [],
        conflict: null, challenge: null
    };
};
const decoConflict = (per: SEvent[], club: SEvent[]) =>
    per.map<SEvent>((ev) => {
        if (!ev.conflictingEventIds.length) return { ...ev, conflict: null };
        const src = club.find((c) => ev.conflictingEventIds.includes(c.eventId) && parseD(ev.startsAt) < parseD(c.endsAt) && parseD(ev.endsAt) > parseD(c.startsAt))
            ?? club.find((c) => ev.conflictingEventIds.includes(c.eventId)) ?? null;
        if (!src) return { ...ev, conflict: { sourceEventId: '', sourceTitle: 'Club schedule', overlapMinutes: 0, severity: 'warning', explanation: 'Overlaps with club schedule.' } };
        const os = Math.max(parseD(ev.startsAt).getTime(), parseD(src.startsAt).getTime());
        const oe = Math.min(parseD(ev.endsAt).getTime(), parseD(src.endsAt).getTime());
        const om = Math.max(0, Math.round((oe - os) / 60000));
        const sev = om >= 45 ? 'critical' as const : 'warning' as const;
        return { ...ev, conflict: { sourceEventId: src.id, sourceTitle: src.title, overlapMinutes: om, severity: sev, explanation: `Overlaps with ${src.title} for ${om} minutes.` } };
    });

export const CalendarPage = ({}: CalendarPageProps) => {
    const navigate = useNavigate();
    const colRef = useRef<HTMLDivElement | null>(null);
    const [ctx, setCtx] = useState<ClubMembershipContext | null>(null);
    const [ctxOk, setCtxOk] = useState(false);
    const [booted, setBooted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [loadN, setLoadN] = useState<string | null>(null);
    const [actN, setActN] = useState<Notice | null>(null);
    const [surface, setSurface] = useState<WorkspaceSurface>('MY_SCHEDULE');
    const [vm, setVm] = useState<WorkspaceView>('week');
    const [cursor, setCursor] = useState(() => new Date());
    const [etypes, setEtypes] = useState<ScheduleEventType[]>(EVENT_TYPES);
    const [pubOnly, setPubOnly] = useState(false);
    const [clubEv, setClubEv] = useState<SEvent[]>([]);
    const [perRaw, setPerRaw] = useState<SEvent[]>([]);
    const [rk, setRk] = useState(0);

    const [modal, setModal] = useState(false);
    const [mmode, setMmode] = useState<'create' | 'edit'>('create');
    const [mvals, setMvals] = useState<EventCreationFormValues>(emptyForm());
    const [eid, setEid] = useState<number | null>(null);

    const [railW, setRailW] = useState(() => Number(localStorage.getItem('talanti:schedule-left-rail')) || DEFAULT_LEFT);
    const [resizing, setResizing] = useState<{ sx: number; sw: number } | null>(null);

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
                setSurface(c?.clubId && canManageClubOperations(c?.myRole) ? 'CLUB_SCHEDULE' : 'MY_SCHEDULE');
            } catch (e) { if (a) { setCtx(null); setSurface('MY_SCHEDULE'); setLoadN(extractApiErrorMessage(e, 'Membership unavailable.')); } }
            finally { if (a) setCtxOk(true); }
        })();
        return () => { a = false; };
    }, []);

    useEffect(() => { localStorage.setItem('talanti:schedule-left-rail', String(Math.round(railW))); }, [railW]);

    useEffect(() => {
        if (!resizing) return;
        const mv = (e: PointerEvent) => {
            const cw = colRef.current?.getBoundingClientRect().width ?? window.innerWidth;
            setRailW(Math.round(Math.max(MIN_LEFT, Math.min(MAX_LEFT, Math.min(resizing.sw + (e.clientX - resizing.sx), cw - RESIZER - MIN_CTR)))));
        };
        const up = () => { setResizing(null); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
        return () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    }, [resizing]);

    const canClub = Boolean(ctx?.clubId);
    const canMgmt = canManageClubOperations(ctx?.myRole);
    const clubLbl = ctx?.clubName ?? 'Club Schedule';
    const vr = useMemo(() => vrng(vm, cursor), [cursor, vm]);
    const rw = useMemo(() => {
        const pd = vm === 'month' ? 14 : vm === 'week' ? 7 : 2;
        return { from: addD(vr.s, -pd), to: addD(vr.e, pd) };
    }, [vm, vr]);

    useEffect(() => {
        if (!ctxOk) return;
        let a = true;
        (async () => {
            setBusy(true);
            try {
                const from = apiDt(rw.from), to = apiDt(rw.to);
                const [per, clb] = await Promise.all([
                    fetchMySchedule(from, to),
                    ctx?.clubId ? fetchClubSchedule(ctx.clubId, from, to) : Promise.resolve([])
                ]);
                if (!a) return;
                setClubEv(clb.map((e) => toWE(e, clubLbl)));
                setPerRaw(per.map((e) => toWE(e, 'Visible only to you')));
                setLoadN(null);
            } catch (e) { if (a) { setLoadN(extractApiErrorMessage(e, 'Schedule load failed.')); setClubEv([]); setPerRaw([]); } }
            finally { if (a) { setBusy(false); setBooted(true); } }
        })();
        return () => { a = false; };
    }, [clubLbl, ctx?.clubId, ctxOk, rk, rw.from, rw.to]);

    const personal = useMemo(() => decoConflict(perRaw, clubEv), [clubEv, perRaw]);
    const active = surface === 'CLUB_SCHEDULE' ? clubEv : personal;

    const filtered = useMemo(() =>
        active.filter((e) => etypes.includes(e.eventType))
            .filter((e) => ix(e, vr.s, vr.e))
            .filter((e) => surface === 'CLUB_SCHEDULE' ? (!pubOnly || isPub(e)) : true)
            .sort((a, b) => parseD(a.startsAt).getTime() - parseD(b.startsAt).getTime()),
        [active, etypes, pubOnly, vr, surface]);

    const monthE = useMemo(() => filtered.reduce<Record<string, SEvent[]>>((acc, e) => {
        const k = dk(parseD(e.startsAt));
        acc[k] = [...(acc[k] ?? []), e];
        return acc;
    }, {}), [filtered]);

    const weekDays = useMemo(() => vm === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addD(sow(cursor), i)), [cursor, vm]);
    const canCreate = surface === 'MY_SCHEDULE' || canMgmt;

    const openCreate = (anchor?: Date, ptype?: ScheduleEventType) => {
        const s = normAnchor(surface, anchor ?? cursor);
        const et = ptype ?? (surface === 'CLUB_SCHEDULE' ? 'TRAINING' : 'ACTIVITY');
        const end = addM(s, durationByType[et]);
        setMmode('create'); setEid(null);
        setMvals({ eventType: et, title: '', date: inpDate(s), startTime: inpTime(s), endTime: inpTime(end), isRecurring: false, locationName: '', locationLat: '', locationLng: '', visibility: 'PRIVATE', publishAt: '' });
        setModal(true);
    };

    const openEdit = (event: SEvent) => {
        const s = parseD(event.startsAt), e = parseD(event.endsAt);
        const rc = event.recurrence;
        setMmode('edit'); setEid(event.eventId);
        setMvals({
            eventType: event.eventType, title: event.title,
            date: inpDate(s), startTime: inpTime(s), endTime: inpTime(e),
            isRecurring: Boolean(rc), locationName: event.locationText ?? '',
            locationLat: event.locationLat != null ? String(event.locationLat) : '',
            locationLng: event.locationLng != null ? String(event.locationLng) : '',
            visibility: event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility,
            publishAt: event.publishAt ? inpDt(parseD(event.publishAt)) : '',
            description: event.description ?? '',
            recurrenceDays: rc ? recOrder.filter((d) => rc.daysOfWeek.includes(d)) : [gDow(s)],
            recurrenceStartDate: rc?.startDate ?? inpDate(s),
            recurrenceEndDate: rc?.endDate ?? '',
            recurrenceStartTime: rc ? normTime(rc.startTime) : inpTime(s),
            recurrenceEndTime: rc ? normTime(rc.endTime) : inpTime(e),
        });
        setModal(true);
    };

    const handleSubmit = async (payload: ScheduleEventUpsertInput, meta: { eventType: ScheduleEventType; recurring: boolean }) => {
        if (!etypes.includes(meta.eventType)) setEtypes((p) => [...p, meta.eventType]);
        if (mmode === 'create') {
            if (surface === 'CLUB_SCHEDULE') {
                if (!ctx?.clubId) throw new Error('No club context.');
                await createClubEvent(ctx.clubId, payload);
                setActN({ tone: 'success', message: meta.recurring ? 'Club event with recurrence saved.' : 'Club event saved.' });
            } else {
                const r = await createMyEvent(payload);
                setActN({ tone: r.conflict ? 'warning' : 'success', message: r.conflict ? 'Personal event saved with conflict warning.' : 'Personal event saved.' });
            }
        } else {
            await updateScheduleEvent(eid ?? 0, payload);
            setActN({ tone: 'success', message: 'Event updated.' });
        }
        setModal(false); setRk((k) => k + 1);
    };

    const stats: Array<{ label: string; value: string; tone: 'green' | 'blue' | 'purple' | 'pink' | 'neutral' }> = [
        { label: 'Events', value: String(filtered.length), tone: 'blue' },
        { label: 'Access', value: surface === 'CLUB_SCHEDULE' ? (canMgmt ? 'Admin' : 'Read') : 'Private', tone: 'purple' }
    ];

    if (!booted && (busy || !ctxOk)) {
        return (
            <div className="flex h-full min-h-0 items-center justify-center" style={{ backgroundColor: 'var(--fc-page-bg)' }}>
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[var(--fc-accent)]" />
                    <p className="text-xs font-semibold text-[var(--fc-text-secondary)]">Loading Schedule</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ backgroundColor: 'var(--fc-page-bg)', color: 'var(--fc-text-primary)' }}>
            <ScheduleWorkspaceHeader
                workspaceSurface={surface} canOpenClubSchedule={canClub}
                rangeLabel={fmtRange(vm, cursor)} scheduleBusy={busy}
                onSelectSurface={setSurface}
                onPrevious={() => setCursor((d) => step(vm, d, -1))}
                onToday={() => setCursor(new Date())}
                onNext={() => setCursor((d) => step(vm, d, 1))}
                onCreateEvent={() => openCreate()}
                onReplayTutorial={() => {
                    localStorage.removeItem('tutorial.calendar.completed');
                    setShowTutorial(true);
                }}
            />

            <div className="flex min-h-0 flex-1">
                <div ref={colRef} className="flex min-h-0 flex-1">
                    <aside className="min-h-0 overflow-y-auto border-r border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] px-2.5 py-3" style={{ width: railW, flexShrink: 0 }}>
                        <div className="flex flex-col gap-4">
                            {/* Back navigation */}
                            <button type="button"
                                data-tutorial="calendar-back-nav"
                                onClick={() => navigate(canClub && ctx?.clubId ? `/clubs/${ctx.clubId}` : '/feed')}
                                className="flex items-center gap-1.5 rounded-[var(--fc-radius)] px-2 py-1.5 text-xs font-medium text-[var(--fc-text-muted)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                                <ArrowLeft className="h-3.5 w-3.5" />
                                {canClub && ctx?.clubId ? `Back to ${clubLbl}` : 'Back to Feed'}
                            </button>

                            <div data-tutorial="calendar-event-filters" className="border-t border-[var(--fc-border)] pt-4 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fc-text-muted)]">Event Types</p>
                                <div className="space-y-1">
                                    {EVENT_TYPES.map((type) => {
                                        const meta = eventTypeCopy[type];
                                        const on = etypes.includes(type);
                                        return (
                                            <button key={type} type="button"
                                                onClick={() => setEtypes((p) => p.includes(type) ? p.filter((t) => t !== type) : [...p, type])}
                                                className="flex w-full items-center justify-between rounded-[var(--fc-radius)] px-2.5 py-2 text-left transition-colors hover:bg-[var(--fc-surface-hover)]">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.accent }} />
                                                    <span className="text-xs font-medium text-[var(--fc-text-primary)]">{meta.label}</span>
                                                </div>
                                                <span className={`inline-flex h-5 w-9 items-center rounded-full border transition-colors ${on ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] justify-end' : 'border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] justify-start'}`}>
                                                    <span className="mx-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? 'var(--fc-accent)' : 'var(--fc-text-muted)' }} />
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {surface === 'CLUB_SCHEDULE' && (
                                    <button type="button" onClick={() => setPubOnly((p) => !p)}
                                        className="flex w-full items-center justify-between rounded-[var(--fc-radius)] border-t border-[var(--fc-border)] px-2.5 pt-3 text-left transition-colors hover:bg-[var(--fc-surface-hover)]">
                                        <span className="text-xs font-medium text-[var(--fc-text-secondary)]">Public only</span>
                                        <span className={`inline-flex h-5 w-9 items-center rounded-full border transition-colors ${pubOnly ? 'border-[var(--fc-accent)] bg-[var(--fc-accent-soft)] justify-end' : 'border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] justify-start'}`}>
                                            <span className="mx-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pubOnly ? 'var(--fc-accent)' : 'var(--fc-text-muted)' }} />
                                        </span>
                                    </button>
                                )}
                            </div>
                            <div data-tutorial="calendar-standing-schedule">
                                <StandingSchedule events={clubEv} />
                            </div>
                        </div>
                    </aside>

                    <div role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabIndex={0}
                        onPointerDown={(e) => setResizing({ sx: e.clientX, sw: railW })}
                        onDoubleClick={() => setRailW(DEFAULT_LEFT)}
                        className="w-[12px] shrink-0 cursor-col-resize transition-colors hover:bg-[var(--fc-border)]"
                        style={{ backgroundColor: resizing ? 'var(--fc-accent-border)' : undefined }} />

                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ScheduleToolbar
                            workspaceLabel={surface === 'CLUB_SCHEDULE' ? clubLbl : 'My Schedule'}
                            rangeLabel={fmtRange(vm, cursor)}
                            viewMode={vm}
                            stats={stats}
                            scheduleBusy={busy}
                            onViewModeChange={setVm}
                        />
                        {actN && <NoticeBanner notice={actN} />}
                        {loadN && <NoticeBanner notice={{ tone: 'warning', message: loadN }} />}
                        <div className="min-h-0 flex-1 overflow-hidden">
                            {filtered.length === 0 ? (
                                <div className="flex h-full items-center justify-center px-6 text-center">
                                    <div className="max-w-md">
                                        <CalendarDays className="mx-auto h-10 w-10 text-[var(--fc-text-muted)]" />
                                        <h2 className="mt-4 text-base font-semibold text-[var(--fc-text-primary)]">No Schedule Items In View</h2>
                                        <p className="mt-2 text-sm text-[var(--fc-text-secondary)]">
                                            {surface === 'CLUB_SCHEDULE' && !canClub ? 'Join a club to access the club schedule.' : 'Adjust filters or create a new event.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <ScheduleGrid
                                    viewMode={vm} cursorDate={cursor}
                                    monthEvents={monthE} days={weekDays} events={filtered}
                                    onSelectDate={setCursor} onEditEvent={openEdit}
                                    canCreate={canCreate} onCreateAt={(d) => openCreate(d)}
                                />
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {modal && (
                <EventCreationModal isOpen mode={mmode} surface={surface as ModalSurface}
                    initialValues={mvals} clubId={ctx?.clubId ?? null} targetEventId={eid ?? undefined}
                    subjectLabel={surface === 'CLUB_SCHEDULE' ? clubLbl : 'Visible only to you'}
                    onClose={() => setModal(false)} onSubmit={handleSubmit} />
            )}

            {showTutorial && <CalendarTutorial onComplete={() => setShowTutorial(false)} />}
        </div>
    );
};

function emptyForm(): EventCreationFormValues {
    return { eventType: null, title: '', date: '', startTime: '', endTime: '', isRecurring: false, locationName: '', locationLat: '', locationLng: '', visibility: 'PRIVATE', publishAt: '' };
}

const ns: Record<NoticeTone, CSSProperties> = {
    success: { borderColor: 'var(--fc-accent)', backgroundColor: 'var(--fc-accent-soft)', color: 'var(--fc-accent)' },
    warning: { borderColor: 'var(--fc-state-warning)', backgroundColor: 'rgba(217,119,6,0.1)', color: 'var(--fc-state-warning)' },
    error: { borderColor: 'var(--fc-state-danger)', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--fc-state-danger)' }
};

const NoticeBanner = ({ notice }: { notice: Notice }) => (
    <div className="border-b border-[var(--fc-border)] px-4 py-2.5">
        <div className="flex items-start gap-2.5 rounded-[var(--fc-radius)] border px-3 py-2.5 text-sm" style={ns[notice.tone]}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice.message}</span>
        </div>
    </div>
);
