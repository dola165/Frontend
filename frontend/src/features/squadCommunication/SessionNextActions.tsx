import type { SquadCalendarEvent } from './useSquadSchedule';
import { useEffect, useState } from 'react';
import { formatDateTime } from '../../utils/formatting';
import { useJourneyCopy } from './journeyCopy';
import { availability } from './attendance';
import './journey-actions.css';

export function SessionNextActions({ events, canManage, playerId, onSelect, compact = false }: {
    events: SquadCalendarEvent[]; canManage: boolean; playerId?: number; onSelect: (event: SquadCalendarEvent) => void; compact?: boolean;
}) {
    const copy = useJourneyCopy();
    const [now, setNow] = useState(Date.now);
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
    const upcoming = events.filter(event => event.session && (playerId == null || event.session.attendance.some(p => p.id === playerId && p.active !== false)) && event.status !== 'CANCELLED' && Date.parse(event.endsAt) > now)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    // Opt-out: only events where the coach asked for confirmation (or that changed after a reply) need an answer.
    const toConfirm = (event: SquadCalendarEvent) => availability(event.session!).toConfirm.filter(p => playerId == null || p.id === playerId);
    const attention = upcoming.filter(event => toConfirm(event).length > 0);
    const next = attention.find(event => toConfirm(event).some(p => p.response === 'RECONFIRMATION_REQUIRED')) ?? attention[0] ?? upcoming[0];
    if (!next) return null;
    const pending = attention.reduce((count, event) => count + toConfirm(event).length, 0);
    if (compact && pending === 0) return null;
    const reconfirm = toConfirm(next).some(p => p.response === 'RECONFIRMATION_REQUIRED');
    return <section className={`journey-actions session-next-action ${compact ? 'is-compact' : ''} ${pending > 0 ? 'needs-response' : ''}`} aria-label={copy('Session next action', 'სესიის შემდეგი ნაბიჯი')}>
        <div><small>{copy('Next action in this date range', 'შემდეგი ნაბიჯი არჩეულ პერიოდში')}</small><h2>{canManage
            ? pending ? copy('Confirmations to follow up', 'დასადასტურებელი პასუხები') : copy('Your next event', 'თქვენი შემდეგი ღონისძიება')
            : reconfirm ? copy('Plans changed — confirm again', 'გეგმა შეიცვალა — დაადასტურეთ ხელახლა') : pending ? copy('The coach asked you to confirm', 'მწვრთნელი დადასტურებას გთხოვთ') : copy('Your next commitment', 'თქვენი შემდეგი შეხვედრა')}</h2>
            <p>{formatDateTime(next.startsAt)}{pending > 0 && ` · ${pending} ${copy('to confirm', 'დასადასტურებელი')}`}</p>
            {!compact && !pending && <p>{copy('Everyone is expected unless they say they can’t come.', 'ყველა მოსალოდნელია, თუ არ გვაცნობებენ, რომ ვერ მოვლენ.')}</p>}</div>
        <button type="button" onClick={() => onSelect(next)}>{canManage ? copy('See availability', 'ხელმისაწვდომობის ნახვა') : pending ? copy('Confirm or say you can’t come', 'დადასტურება ან უარი') : copy('View event', 'ღონისძიების ნახვა')}</button>
    </section>;
}
