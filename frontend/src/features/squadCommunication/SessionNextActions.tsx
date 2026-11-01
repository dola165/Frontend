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
    const next = upcoming[0];
    if (!next || compact) return null;
    return <section className="journey-actions session-next-action" aria-label={copy('Session next action', 'სესიის შემდეგი ნაბიჯი')}>
        <div><small>{copy('Next event in this date range', 'შემდეგი ღონისძიება არჩეულ პერიოდში')}</small><h2>{canManage
            ? copy('Your next event', 'თქვენი შემდეგი ღონისძიება') : copy('Your next commitment', 'თქვენი შემდეგი შეხვედრა')}</h2>
            <p>{formatDateTime(next.startsAt)}</p>
            <p>{copy('Everyone is expected unless they say they can’t come.', 'ყველა მოსალოდნელია, თუ არ გვაცნობებენ, რომ ვერ მოვლენ.')}</p></div>
        <button type="button" onClick={() => onSelect(next)}>{canManage ? copy('See availability', 'ხელმისაწვდომობის ნახვა') : copy('View event', 'ღონისძიების ნახვა')}</button>
    </section>;
}
