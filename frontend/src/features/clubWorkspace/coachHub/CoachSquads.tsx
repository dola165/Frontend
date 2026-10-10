import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Section } from '../../../design/primitives';
import { Crest, FaceStack } from '../../../design/visuals';
import { dayLabel, timeLabel } from '../fixtures';
import { sessionKind, upcoming } from './useCoachData';
import { ActivityBadge, ReplySummary } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/** One card per squad: crest, name, the players' faces, and the next match with who's coming. A card opens that squad. */
export function CoachSquads({ data }: { data: CoachData }) {
    return <Section boxed title="Squads">
        <ul className="ch-squads" aria-label="Squads">{data.mine.map(squad => {
            const space = data.squads?.find(item => item.id === squad.id);
            const next = space ? upcoming(space, data.now) : [], match = next.find(session => sessionKind(session) !== 'TRAINING') ?? next[0];
            const players = data.roles.people.filter(person => person.squad_id === squad.id).map(person => ({ id: person.id, name: person.name }));
            return <li key={squad.id}><Link className="ch-squad" to={`/my-squads?squad=${squad.id}`}>
                <span className="ch-squad__head"><Crest src={data.clubLogo} name={data.clubName} size={40} />
                    <span className="ch-squad__name"><strong>{squad.name}</strong><span>{[data.roleOf(squad.id), `${squad.player_count} players`].filter(Boolean).join(' · ')}</span></span>
                    <ChevronRight className="cw-chevron" aria-hidden="true" /></span>
                <FaceStack people={players} max={9} size={28} label={`${players.length} players`} />
                {match && <span className="ch-squad__next">
                    <span className="ch-squad__when"><ActivityBadge kind={sessionKind(match)} size={24} /><span><strong>{dayLabel(match.starts_at, data.now)} {timeLabel(match.starts_at)}</strong> {match.title}</span></span>
                    <ReplySummary session={match} />
                </span>}
            </Link></li>;
        })}</ul>
    </Section>;
}
