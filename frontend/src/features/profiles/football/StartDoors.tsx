import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Shield, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { createHref } from '../../pages/create/entry';
import { useAction } from '../../actions/useAction';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** Doors into the flows that already exist, each shown when the rule-checker allows it (starting a club, adding a child). */
export function StartDoors() {
    const copy = useJourneyCopy();
    const location = useLocation();
    const club = useAction('start_club'), child = useAction('add_child');
    const doors: { id: string; icon: LucideIcon; tone: string; label: string; hint: string; to: string }[] = [
        { id: 'squad', icon: Users, tone: 'training', label: copy('Join a squad', 'გუნდში გაწევრება'), hint: copy('With the coach’s link, or find one near you', 'მწვრთნელის ბმულით, ან იპოვეთ ახლოს'), to: '/world/opportunities?tab=groups' },
        ...(club.allowed ? [
            { id: 'club', icon: Shield, tone: 'match', label: copy('Start a club', 'კლუბის შექმნა'), hint: copy('Your club’s page in a minute', 'კლუბის გვერდი ერთ წუთში'), to: createHref(location, 'CLUB', 'profile') },
        ] : []),
        ...(child.href ? [
            { id: 'child', icon: UserPlus, tone: 'event', label: copy('Add my child', 'ჩემი შვილის დამატება'), hint: copy('Their player card in Parent Hub', 'მოთამაშის ბარათი მშობლის სივრცეში'), to: child.href },
        ] : []),
    ];
    return <ul className="gk-fp-doors" aria-label={copy('Start something', 'დაიწყეთ')}>
        {doors.map(door => <li key={door.id}><Link to={door.to} className="gk-fp-door" data-tone={door.tone}>
            <span className="gk-fp-door__icon" aria-hidden="true"><door.icon /></span>
            <span className="gk-fp-door__text"><strong>{door.label}</strong><small>{door.hint}</small></span>
            <ChevronRight aria-hidden="true" className="gk-fp-door__arrow" />
        </Link></li>)}
    </ul>;
}
