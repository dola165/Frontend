import type { Participant } from '../../admissions/types';

export interface QuickStart { label: string; name?: string; to: string }

/** Entry points by intent, each a directory with its tab and filters already chosen. */
export function quickStarts(city: string, children: Participant[] = [], child?: Participant): QuickStart[] {
    const near = encodeURIComponent(city);
    const places = (person: Participant) => ({ label: 'Places to train for {name}', name: person.name, to: `/world/opportunities?tab=groups&player=${person.id}` });
    const clubs = (person: Participant) => ({ label: 'Clubs for {name}', name: person.name, to: `/world/clubs?player=${person.id}&city=${near}` });
    // A parent sees the places to train for each child first; once one child is chosen, that child's clubs too.
    const forChildren = child ? [places(child), clubs(child)] : children.slice(0, 2).map(places);
    return [
        ...forChildren,
        { label: 'Clubs with open trials', to: `/world/clubs?joinPolicy=OPEN_TRIAL&city=${near}` },
        { label: 'Academies', to: '/world/clubs?type=ACADEMY' },
        { label: 'Football for girls', to: '/world/opportunities?tab=groups&gender=FEMALE' },
        { label: 'Teams looking for a match', to: '/world/matches?tab=exchange' },
        { label: 'Referees', to: '/world/people?role=REFEREE' },
        { label: 'Coaching jobs', to: '/world/opportunities?tab=jobs&category=COACHING' },
        { label: 'Volunteering', to: '/world/opportunities?tab=jobs&engagement=VOLUNTEER' },
        { label: 'Pitches to hire', to: `/world/venues?city=${near}` },
    ];
}
