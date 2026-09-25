import { Link } from 'react-router-dom';
import type { SquadOverview } from './api';
import { squadMessageUrl } from './routes';
import { useJourneyCopy } from './journeyCopy';
import './journey-actions.css';

export function CoachNextActions({ space }: { space: SquadOverview }) {
    const copy = useJourneyCopy();
    if (!space.can_manage || !space.attention) return null;
    const { upcoming_sessions, replies_needed, acknowledgements_needed } = space.attention;
    const conversations = space.threads.filter(thread => thread.unread_count > 0).length;
    return <section className="journey-actions coach-next-actions" aria-label={copy('Coach next actions', 'მწვრთნელის შემდეგი ნაბიჯები')}>
        <div className="coach-next-copy"><small>{copy('Coach focus', 'მწვრთნელის ფოკუსი')}</small><h2>{copy('Your next seven days', 'თქვენი მომდევნო შვიდი დღე')}</h2></div>
        <div className="coach-next-work"><div className="journey-action-metrics" aria-label={copy('Seven day summary', 'შვიდი დღის შეჯამება')}><span><strong>{upcoming_sessions}</strong>{copy('sessions', 'სესია')}</span><span><strong>{replies_needed}</strong>{copy('family replies', 'ოჯახის პასუხი')}</span><span><strong>{conversations}</strong>{copy('unread conversations', 'წაუკითხავი საუბარი')}</span></div>
            <nav className="journey-actions-links" aria-label={copy('Coach action links', 'მწვრთნელის მოქმედებები')}><Link to={`/squads/${space.id}?tab=sessions`}>{copy('Plan sessions & review replies', 'სესიების დაგეგმვა და პასუხების ნახვა')}</Link>
                {acknowledgements_needed > 0 && <a href="#coach-updates">{acknowledgements_needed} {copy('update acknowledgements pending', 'განახლების დასტურია მოსალოდნელი')}</a>}
                {conversations > 0 && <Link to={squadMessageUrl(space.id,true)}>{conversations} {copy('unread family conversations', 'ოჯახის წაუკითხავი საუბარი')}</Link>}</nav></div>
    </section>;
}
