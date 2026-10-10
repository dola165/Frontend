import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, MessageCircle } from 'lucide-react';
import { ButtonLink, Count, Section } from '../../../design/primitives';
import type { SquadSession } from '../../squadCommunication/api';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { dayLabel, timeLabel } from '../fixtures';
import { replies, sessionKind, upcoming } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import '../club-workspace.css';
import './coach-hub.css';

/** One card per squad I coach: my role and its size, the next training and match with who's coming, and the next steps. */
export function CoachSquads({ data }: { data: CoachData }) {
    const { now } = data;
    const line = (session: SquadSession) => {
        const kind = sessionKind(session), Icon = activityIcons[kind], reply = replies(session);
        return <Link className="ch-next" to={`?tab=schedule&session=${session.id}`} style={{ '--activity': activityColors[kind] } as CSSProperties}>
            <Icon aria-hidden="true" />
            <span className="ch-next__text"><span className="ch-next__title"><strong>{dayLabel(session.starts_at, now)} {timeLabel(session.starts_at)}</strong> · {session.title}</span>
                <span className={`ch-next__replies${reply.asked && reply.none ? ' ch-next__replies--chase' : ''}`}>{reply.text}</span></span>
        </Link>;
    };
    return <Section boxed title="Squads" hint={`${data.mine.length}`}>
        <ul className="cw-squads ch-squads" aria-label="Squads">{data.mine.map(squad => {
            const space = data.squads?.find(item => item.id === squad.id);
            const next = space ? upcoming(space, now) : [], training = next.find(session => sessionKind(session) === 'TRAINING'), match = next.find(session => sessionKind(session) !== 'TRAINING');
            const unread = space?.overview?.threads.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;
            return <li key={squad.id} className="cw-squad">
                <Link className="cw-squad__head" to={`?squad=${squad.id}`}>
                    <span className="cw-squad__name"><strong>{squad.name}</strong><span>{[data.roleOf(squad.id), `${squad.player_count} players`].filter(Boolean).join(' · ')}</span></span>
                </Link>
                <div className="ch-squad__week">
                    {training ? line(training) : <p className="ch-next ch-next--none">{space ? 'No training planned' : 'Loading the week…'}</p>}
                    {match && line(match)}
                </div>
                <div className="cw-squad__links">
                    <ButtonLink size="sm" to={`?squad=${squad.id}`}>Open squad</ButtonLink>
                    <ButtonLink size="sm" variant="ghost" to={`?tab=updates&compose=1&squad=${squad.id}`}><Megaphone aria-hidden="true" />Update</ButtonLink>
                    <ButtonLink size="sm" variant="ghost" to={`/messages?squadId=${squad.id}&channel=coach`}><MessageCircle aria-hidden="true" />Families<Count value={unread} /></ButtonLink>
                </div>
            </li>;
        })}</ul>
    </Section>;
}
