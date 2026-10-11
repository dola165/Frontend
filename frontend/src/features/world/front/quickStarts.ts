import type { Participant } from '../../admissions/types';
import type { WorldAudience } from './audience';

export interface QuickStart { label: string; name?: string; to: string }

/** Entry points by intent, each a directory with its tab and filters already chosen, in the order each audience needs them. */
export function quickStarts(city: string, audience: WorldAudience, children: Participant[] = [], child?: Participant): QuickStart[] {
    const near = encodeURIComponent(city);
    const places = (person: Participant) => ({ label: 'Places to train for {name}', name: person.name, to: `/world/opportunities?tab=groups&player=${person.id}` });
    const clubs = (person: Participant) => ({ label: 'Clubs for {name}', name: person.name, to: `/world/clubs?player=${person.id}&city=${near}` });
    const start = {
        trials: { label: 'Clubs with open trials', to: `/world/clubs?joinPolicy=OPEN_TRIAL&city=${near}` },
        academies: { label: 'Academies', to: '/world/clubs?type=ACADEMY' },
        girls: { label: 'Football for girls', to: '/world/opportunities?tab=groups&gender=FEMALE' },
        opponents: { label: 'Teams looking for a match', to: '/world/matches?tab=exchange' },
        referees: { label: 'Referees', to: '/world/people?role=REFEREE' },
        competitions: { label: 'Competitions open for entries', to: '/world/competitions?registration=OPEN' },
        coaching: { label: 'Coaching jobs', to: '/world/opportunities?tab=jobs&category=COACHING' },
        volunteering: { label: 'Volunteering', to: '/world/opportunities?tab=jobs&engagement=VOLUNTEER' },
        pitches: { label: 'Pitches to hire', to: `/world/venues?city=${near}` },
    };
    // A parent sees the places to train for each child first; once one child is chosen, that child's clubs too.
    if (audience === 'parent' || audience === 'member' && children.length) {
        const forChildren = child ? [places(child), clubs(child)] : children.slice(0, 2).map(places);
        return [...forChildren, start.trials, start.academies, start.girls, start.pitches];
    }
    // A coach who is also a parent keeps one way to the children's places at the end.
    if (audience === 'coach') return [start.opponents, start.referees, start.pitches, start.competitions, start.coaching, start.volunteering, ...children.slice(0, 1).map(places)];
    return [start.trials, start.academies, start.girls, start.opponents, start.referees, start.coaching, start.volunteering, start.pitches];
}
