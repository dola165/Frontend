import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { localDateISO } from '../../components/schedule/scheduleFormUtils';
import { formatDate } from '../../utils/formatting';
import { useSquadSchedule, type CalendarSquad } from './useSquadSchedule';
import { SquadSessionDetails } from './SquadSessionDialog';
import './squad-schedule.css';

export function SquadSchedulePreview({ squad }: { squad: CalendarSquad }) {
    const [revision, setRevision] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const today = new Date();
    const until = new Date(today); until.setDate(until.getDate() + 30);
    const { events, loading, error } = useSquadSchedule([squad], `${localDateISO(today)}T00:00:00`, `${localDateISO(until)}T23:59:59`, revision);
    const upcoming = events.filter(event => Date.parse(event.endsAt) >= Date.now() && new Date(event.startsAt) <= until)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3);
    const selected = events.find(event => event.id === selectedId);
    return <section className="squad-schedule-preview" aria-label="Upcoming squad events">
        <header><h2>Schedule</h2><p>Coming up · next 30 days</p></header>
        {loading && <p role="status">Loading schedule…</p>}
        {error && <p role="alert">{error} <button onClick={() => setRevision(n => n + 1)}>Try again</button></p>}
        {!loading && upcoming.map(event => <button className="squad-preview-event" key={event.id} onClick={() => setSelectedId(event.id)}>
            <span className="squad-preview-date">{formatDate(event.startsAt, { day: 'numeric' })}<small>{formatDate(event.startsAt, { month: 'short' })}</small></span>
            <span><strong>{event.title}</strong><small>{formatDate(event.startsAt, { weekday: 'long' })} · {formatDate(event.startsAt, { hour: '2-digit', minute: '2-digit' })} – {formatDate(event.endsAt, { hour: '2-digit', minute: '2-digit' })}</small>
                {event.status === 'CANCELLED' ? <small className="squad-preview-cancelled">Cancelled{event.session?.cancellation_reason ? ` · ${event.session.cancellation_reason}` : ''}</small> : event.locationText && <small className="squad-preview-location"><MapPin size={12}/>{event.locationText}</small>}</span>
        </button>)}
        {!loading && !error && upcoming.length === 0 && <p>No upcoming events in the next 30 days.</p>}
        <footer><Link className="squad-preview-more" to={`/calendar?scope=squad&squadId=${squad.id}`}>View full schedule <ArrowRight size={14}/></Link></footer>
        <p className="squad-preview-timezone">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
        {selected && <SquadSessionDetails event={selected} onClose={() => setSelectedId(null)} onSaved={() => setRevision(n => n + 1)}/>}
    </section>;
}
