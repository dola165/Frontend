import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Shield, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { createHref } from '../../pages/create/entry';
import { useMayCreatePages } from '../../pages/create/useMayCreatePages';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/** Doors into the flows that already exist. Starting a club and adding a child are for adults. */
export function StartDoors() {
    const copy = useJourneyCopy();
    const location = useLocation();
    const adult = useMayCreatePages();
    const doors: { id: string; icon: LucideIcon; tone: string; label: string; hint: string; to: string }[] = [
        { id: 'squad', icon: Users, tone: 'training', label: copy('Join a squad', 'გუნდში გაწევრება'), hint: copy('With the coach’s link, or find one near you', 'მწვრთნელის ბმულით, ან იპოვეთ ახლოს'), to: '/world/opportunities?tab=groups' },
        ...(adult ? [
            { id: 'club', icon: Shield, tone: 'match', label: copy('Start a club', 'კლუბის შექმნა'), hint: copy('Your club’s page in a minute', 'კლუბის გვერდი ერთ წუთში'), to: createHref(location, 'CLUB', 'profile') },
            { id: 'child', icon: UserPlus, tone: 'event', label: copy('Add my child', 'ჩემი შვილის დამატება'), hint: copy('Their player card in Parent Hub', 'მოთამაშის ბარათი მშობლის სივრცეში'), to: '/parent?tab=children' },
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
