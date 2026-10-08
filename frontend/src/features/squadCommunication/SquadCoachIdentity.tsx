import type { SquadOverview } from './api';
import './squad-communication.css';

export function SquadCoachIdentity({space}: {space: Pick<SquadOverview, 'head_coach_id' | 'coaches'>}) {
    const assigned = space.coaches?.find(coach => coach.user_id === space.head_coach_id);
    const people = assigned ? [assigned] : space.coaches ?? [];
    return <div className="squad-coach-identity">
        <span className="squad-coach-avatar" aria-hidden="true">{people[0]?.full_name.slice(0, 1) ?? '?'}</span>
        <div><small>{assigned ? 'Your coach' : 'Coaching team'}</small><strong>{people.length ? people.map(coach => coach.full_name).join(' · ') : 'Coach not assigned yet'}</strong></div>
    </div>;
}
