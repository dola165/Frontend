import type { SquadCalendarEvent } from './useSquadSchedule';
import { useEffect, useState } from 'react';
import { formatDateTime } from '../../utils/formatting';
import { useJourneyCopy } from './journeyCopy';
import './journey-actions.css';

export function SessionNextActions({ events, canManage, playerId, onSelect, compact = false }: {
    events: SquadCalendarEvent[]; canManage: boolean; playerId?: number; onSelect: (event: SquadCalendarEvent) => void; compact?: boolean;
}) {
    const copy = useJourneyCopy();
    const [now, setNow] = useState(Date.now);
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
    const upcoming = events.filter(event => event.session && (playerId == null || event.session.attendance.some(p => p.id === playerId && p.active !== false)) && event.status !== 'CANCELLED' && Date.parse(event.endsAt) > now)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const replies = (event: SquadCalendarEvent) => event.session!.attendance.filter(p => p.active !== false && (playerId == null || p.id === playerId));
    const attention = upcoming.filter(event => event.session?.response_requested !== false && replies(event).some(p => ['UNANSWERED', 'RECONFIRMATION_REQUIRED'].includes(p.response)));
    const next = attention.find(event => replies(event).some(p => p.response === 'RECONFIRMATION_REQUIRED')) ?? attention[0] ?? upcoming[0];
    if (!next) return null;
    const pending = attention.reduce((count, event) => count + replies(event).filter(p => ['UNANSWERED', 'RECONFIRMATION_REQUIRED'].includes(p.response)).length, 0);
    if (compact && pending === 0) return null;
    const reconfirm = replies(next).some(p => p.response === 'RECONFIRMATION_REQUIRED');
    return <section className={`journey-actions session-next-action ${compact ? 'is-compact' : ''} ${pending > 0 ? 'needs-response' : ''}`} aria-label={copy('Session next action', 'სესიის შემდეგი ნაბიჯი')}>
        <div><small>{copy('Next action in this date range', 'შემდეგი ნაბიჯი არჩეულ პერიოდში')}</small><h2>{canManage
            ? pending ? copy('Availability replies to follow up', 'ხელმისაწვდომობის პასუხები მოსაკითხია') : copy('Your next event', 'თქვენი შემდეგი ღონისძიება')
            : reconfirm ? copy('Plans changed — confirm again', 'გეგმა შეიცვალა — დაადასტურეთ ხელახლა') : pending ? copy('Your reply is needed', 'საჭიროა თქვენი პასუხი') : copy('Your next commitment', 'თქვენი შემდეგი შეხვედრა')}</h2>
            <p>{formatDateTime(next.startsAt)}{pending > 0 && ` · ${pending} ${copy('replies needed', 'პასუხია საჭირო')}`}</p>
            {!compact && <p>{copy('Replies express plans to attend. They do not record actual attendance.', 'პასუხი გამოხატავს დასწრების გეგმას და არა ფაქტობრივ დასწრებას.')}</p>}</div>
        <button type="button" onClick={() => onSelect(next)}>{canManage && next.session?.response_requested !== false ? copy('Review replies', 'პასუხების ნახვა') : pending ? copy('Review & reply', 'ნახვა და პასუხი') : copy('View commitment', 'შეხვედრის ნახვა')}</button>
    </section>;
}
