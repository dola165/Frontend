import { useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, List, MapPin, X } from 'lucide-react';
import { addDays, calendarTime, clockTime, dayDate, trainingBlocks, validTimezone, weekStart, type TrainingSession } from './trainingCalendar';
import './training-calendar.css';

const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) => dayDate(day).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
export function TrainingWeekCalendar({ sessions }: { sessions: TrainingSession[] }) {
  const zone = validTimezone(sessions.find(s => s.timezone)?.timezone);
  const blocks = trainingBlocks(sessions, zone);
  const today = calendarTime(new Date().toISOString(), zone)!.day;
  const firstDay = blocks.find(b => b.day >= today && b.session.status !== 'CANCELLED')?.day ?? blocks[0]?.day ?? today;
  const [chosenWeek, setWeek] = useState<string | null>(null), [view, setView] = useState<'week' | 'list'>('week'), [selectedId, setSelected] = useState<string | null>(null);
  const week = chosenWeek ?? weekStart(firstDay), days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const visible = blocks.filter(b => b.day >= week && b.day <= days[6]);
  const earliest = visible.length ? Math.max(0, Math.min(...visible.map(b => Math.floor(b.start / 60))) - 1) : 8;
  const lastHour = visible.length ? Math.min(24, Math.max(earliest + 6, ...visible.map(b => Math.ceil(b.end / 60) + 1))) : 20;
  const firstHour = Math.max(0, Math.min(earliest, lastHour - 6));
  const start = firstHour * 60, span = (lastHour - firstHour) * 60;
  const minWeek = weekStart([today, ...blocks.map(b => b.day)].sort()[0]);
  const maxWeek = weekStart([addDays(today, 42), ...blocks.map(b => b.day)].sort().at(-1)!);
  const selected = sessions.find(s => s.id === selectedId);
  return <div className="st-calendar">
    <div className="st-toolbar">
      <div className="st-week-controls"><button className="cp-icon-button" aria-label="Previous training week" disabled={week <= minWeek} onClick={() => { setWeek(addDays(week, -7)); setSelected(null); }}><ChevronLeft size={18}/></button><h4 aria-live="polite">{dayLabel(week, { day: 'numeric', month: 'short' })} – {dayLabel(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</h4><button className="cp-icon-button" aria-label="Next training week" disabled={week >= maxWeek} onClick={() => { setWeek(addDays(week, 7)); setSelected(null); }}><ChevronRight size={18}/></button><button className="cp-text-button" onClick={() => { setWeek(weekStart(today)); setSelected(null); }}>This week</button></div>
      <div className="cp-view-switch" role="group" aria-label="Training timetable view"><button aria-pressed={view === 'week'} onClick={() => setView('week')}><CalendarDays size={15}/>Week</button><button aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={15}/>All dates</button></div>
    </div>
    {view === 'week' ? <>
      <div className="st-week" style={{ '--st-hours': lastHour - firstHour } as CSSProperties}>
        <div className="st-time-axis" aria-hidden="true"><div className="st-day-heading"/><div className="st-time-slots">{Array.from({ length: lastHour - firstHour }, (_, i) => <span key={i}>{clockTime((firstHour + i) * 60)}</span>)}</div></div>
        {days.map(day => <section className={`st-day${day === today ? ' is-today' : ''}`} key={day} aria-label={dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}><h5 className="st-day-heading"><span>{dayLabel(day, { weekday: 'short' })}</span><strong>{dayLabel(day, { day: 'numeric' })}</strong></h5><div className="st-day-events">{visible.filter(b => b.day === day).map(b => <button key={`${b.session.id}:${day}`} className={`st-session${b.session.status === 'CANCELLED' ? ' is-cancelled' : ''}`} aria-pressed={selectedId === b.session.id} onClick={() => setSelected(b.session.id)} style={{ top: `${(b.start - start) / span * 100}%`, height: `${(b.end - b.start) / span * 100}%`, left: `calc(${b.lane / b.lanes * 100}% + 3px)`, width: `calc(${100 / b.lanes}% - 6px)` }}><span>{clockTime(b.start)}–{clockTime(b.end)}</span><strong>{b.session.title}</strong>{b.session.status === 'CANCELLED' && <small>Cancelled</small>}</button>)}{!visible.some(b => b.day === day) && <span className="st-day-empty">No sessions</span>}</div></section>)}
      </div>
      {!visible.length && <p className="cp-muted st-empty">No training scheduled this week. Browse the other weeks or choose All dates.</p>}
    </> : <div className="st-agenda">{sessions.map(session => <TrainingDate key={session.id} session={session} zone={zone}/>)}{!sessions.length && <p className="cp-muted">No training sessions are scheduled in this window. Confirm the next session with the club.</p>}</div>}
    {view === 'week' && selected && <div className="st-session-detail" role="region" aria-label="Selected training session"><TrainingDate session={selected} zone={zone}/><button className="cp-icon-button" aria-label="Close session details" onClick={() => setSelected(null)}><X size={18}/></button></div>}
    <p className="st-schedule-note"><CalendarDays size={16}/><span>These are the dates scheduled so far. Individual sessions may change; check the latest times before travelling.</span></p>
    <p className="fj-timezone">Times shown in {zone}. Training frequency and fees are listed in the programme details.</p>
  </div>;
}

function TrainingDate({ session, zone }: { session: TrainingSession; zone: string }) {
  const start = calendarTime(session.startsAt, zone), end = calendarTime(session.endsAt, zone);
  if (!start || !end) return null;
  return <article className={`fj-training-date${session.status === 'CANCELLED' ? ' is-cancelled' : ''}`}><time dateTime={session.startsAt}><strong>{dayLabel(start.day, { day: 'numeric' })}</strong><span>{dayLabel(start.day, { month: 'short' })}</span></time><div><strong>{session.title}</strong><p>{dayLabel(start.day, { weekday: 'long' })} · {clockTime(start.minute)}–{clockTime(end.minute)}{end.day !== start.day && ` (${dayLabel(end.day, { day: 'numeric', month: 'short' })})`}</p>{session.status === 'CANCELLED' ? <span className="fj-cancelled">Cancelled</span> : <p>{session.timesOnly ? 'Session details are shared with squad members.' : <><MapPin size={13}/>{session.location || 'Location to be confirmed'}</>}</p>}</div></article>;
}
