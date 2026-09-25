import { useEffect, useState } from 'react';
import { EventCreationModal, type EventCreationFormValues } from '../../components/schedule/EventCreationModal';
import { PastEventModal } from '../../components/schedule/PastEventModal';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import { createClubEvent, updateScheduleEvent, type DayOfWeek } from '../schedule/api';
import { overview } from './api';
import type { CalendarSquad, SquadCalendarEvent } from './useSquadSchedule';
import { useJourneyCopy } from './journeyCopy';
import { scheduleDestination } from '../schedule/origin';
import { Link } from 'react-router-dom';

/** Preserve the established match/event/recurrence editor, scoped to this squad. */
export function SquadClubEventEditor({ squad, date, event, weekly = false, onClose, onSaved }: {
    squad: CalendarSquad; date: Date; event?: SquadCalendarEvent; weekly?: boolean; onClose: () => void; onSaved: () => void;
}) {
    const copy = useJourneyCopy();
    const [leadership, setLeadership] = useState(false);
    useEffect(() => {
        const abort = new AbortController();
        void overview(squad.id, abort.signal).then(space => { if (!abort.signal.aborted) setLeadership(space.can_assign_coach); }).catch(() => {});
        return () => abort.abort();
    }, [squad.id]);
    const [initial] = useState<EventCreationFormValues>(() => initialForm(squad, date, event, weekly));
    if (!squad.club_id) return null;
    const destination = event && scheduleDestination(event);
    if (destination) return <p><Link to={destination}>{copy('Open match details & next actions', 'მატჩის დეტალები და შემდეგი ნაბიჯები')}</Link></p>;
    if (event && new Date(event.startsAt) < new Date()) return <PastEventModal event={event} clubId={squad.club_id} clubName={squad.academy_name ?? squad.name}
        canComplete={!!squad.can_manage} canRecordResult={leadership} onClose={onClose} onCompleted={onSaved}/>;
    return <EventCreationModal isOpen fixedSquad mode={event ? 'edit' : 'create'} surface="CLUB_SCHEDULE" initialValues={initial}
        clubId={squad.club_id} targetEventId={event?.eventId} targetEventClubId={event?.owningClubId} targetEventStartsAt={event?.startsAt}
        audienceNotice={copy('Club calendar entry: no family invitations or replies. Private entries may not be visible to parents. Use a family session for each date that needs confirmation.', 'კლუბის კალენდრის ჩანაწერი: ოჯახის მოწვევებისა და პასუხების გარეშე. პირადი ჩანაწერი შესაძლოა მშობლებისთვის მიუწვდომელი იყოს. დასტურის საჭიროებისას თითოეული თარიღისთვის გამოიყენეთ ოჯახის სესია.')}
        canManageSchedule={leadership} subjectLabel={`${squad.name} · ${squad.academy_name ?? 'Academy club'}`} onClose={onClose} onCancelled={onSaved}
        onSubmit={async payload => {
            // The selected squad is the destination even if the legacy editor offers another roster.
            const scoped = { ...payload, hostSquadId: squad.id };
            if (event) await updateScheduleEvent(event.eventId, scoped); else await createClubEvent(squad.club_id!, scoped);
            onSaved();
        }}/ >;
}

function initialForm(squad: CalendarSquad, date: Date, event: SquadCalendarEvent | undefined, weekly: boolean): EventCreationFormValues {
    const time = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const start = event ? new Date(event.startsAt) : new Date(date);
    if (!event) start.setHours(18, 0, 0, 0);
    const end = event ? new Date(event.endsAt) : new Date(start.getTime() + 90 * 60000);
    const recurrence = event?.recurrence;
    const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return {
        eventType: event?.eventType ?? (weekly ? 'TRAINING' : null), title: event?.title ?? '', date: localDateISO(start), startTime: time(start), endTime: time(end),
        isRecurring: event?.recurring ?? weekly, hostSquadId: squad.id, opponentClubId: event?.opponentClubId,
        description: event?.description ?? '', locationName: event?.locationText ?? '', locationLat: event?.locationLat == null ? '' : String(event.locationLat), locationLng: event?.locationLng == null ? '' : String(event.locationLng),
        visibility: !event || event.visibility === 'CLUB_ONLY' ? 'PRIVATE' : event.visibility, publishAt: event?.publishAt?.slice(0,16) ?? '',
        recurrenceDays: recurrence?.daysOfWeek ?? [days[start.getDay()]], recurrenceStartDate: recurrence?.startDate ?? localDateISO(start), recurrenceEndDate: recurrence?.endDate ?? '',
        recurrenceStartTime: recurrence?.startTime.slice(0,5) ?? time(start), recurrenceEndTime: recurrence?.endTime.slice(0,5) ?? time(end), recurrenceInterval: recurrence?.intervalValue, recurrenceTimezone: recurrence?.timezone,
    };
}
