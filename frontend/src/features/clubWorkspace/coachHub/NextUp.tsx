import type { CSSProperties } from 'react';
import { ClipboardCheck, MapPin, MessageCircle, Users } from 'lucide-react';
import { ButtonLink, EmptyNote, Panel, Skeleton } from '../../../design/primitives';
import { Crest } from '../../../design/visuals';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { isoDay } from '../../../design/calendar/calendarDates';
import { dayLabel, isToday, timeLabel } from '../fixtures';
import { kindNames, opponentOf, sessionKind, startsIn, upcoming, useCrests } from './useCoachData';
import { ReplyFaces, ReplySummary } from './CoachVisuals';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

/**
 * The very next session or match of the squads shown: when, against whom (with both crests), where, and who's
 * coming as faces ringed by their answer, with the one action that fits (take the register on the day).
 */
export function NextUp({ data }: { data: CoachData }) {
    const next = (data.squads ?? []).filter(squad => data.shown.includes(squad.id))
        .flatMap(squad => upcoming(squad, data.now).map(session => ({ squad: squad.id, session })))
        .sort((a, b) => new Date(a.session.starts_at).getTime() - new Date(b.session.starts_at).getTime())[0];
    const opponent = next ? opponentOf(next.session, next.squad, data.events, data.clubName) : null;
    const crests = useCrests(opponent?.id ? [opponent.id] : []);
    if (!data.squads) return <Panel><div className="ch-next-up ch-next-up--loading" role="status" aria-label="Loading what's next"><Skeleton height={180} /></div></Panel>;
    if (!next) return <Panel><EmptyNote title="Nothing planned yet">Sessions and matches for your squads appear here once they are planned.</EmptyNote></Panel>;

    const { session, squad } = next, kind = sessionKind(session), Icon = activityIcons[kind], start = new Date(session.starts_at);
    const squadName = data.names.get(squad) ?? '';
    const register = kind === 'TRAINING' && isToday(session.starts_at, data.now) && canReadSquad(data.boot, 'ATTENDANCE', squad);
    return <article className="ch-next-up" style={{ '--activity': activityColors[kind] } as CSSProperties} aria-label={`Next up: ${session.title}`}>
        <div className="ch-next-up__media">
            <img src={kind === 'TRAINING' ? '/football/ball-field.jpg' : '/football/touchline.jpg'} alt="" />
            <span className="ch-next-up__kind"><Icon aria-hidden="true" />{kindNames[kind]}</span>
        </div>
        <div className="ch-next-up__body">
            <p className="ch-next-up__when"><strong>{dayLabel(session.starts_at, data.now)} · {timeLabel(session.starts_at)}</strong><span>{startsIn(start.getTime(), data.now)}</span></p>
            {opponent ? <div className="ch-match">
                <span className="ch-match__side"><Crest src={data.clubLogo} name={data.clubName} size={44} /><strong>{squadName}</strong></span>
                <span className="ch-match__vs">vs</span>
                <span className="ch-match__side"><Crest src={opponent.id ? crests.get(opponent.id) : null} name={opponent.name} size={44} /><strong>{opponent.name}</strong></span>
            </div> : <h2 className="ch-next-up__title">{session.title}<span>{squadName}</span></h2>}
            {session.location && <p className="ch-next-up__where"><MapPin aria-hidden="true" />{session.location}</p>}
            <div className="ch-next-up__replies"><ReplyFaces session={session} max={12} /><ReplySummary session={session} /></div>
            <div className="ch-next-up__actions">
                {register && <ButtonLink variant="primary" size="sm" to={data.workHref('attendance', { squad: String(squad), session: String(session.id) })}><ClipboardCheck aria-hidden="true" />Take register</ButtonLink>}
                <ButtonLink size="sm" variant={register ? 'secondary' : 'primary'} to={data.link('calendar', { view: 'week', date: isoDay(start), event: `s-${session.id}` })}><Users aria-hidden="true" />Who’s coming</ButtonLink>
                <ButtonLink size="sm" variant="ghost" to={`/messages?squadId=${squad}`}><MessageCircle aria-hidden="true" />Squad chat</ButtonLink>
            </div>
        </div>
    </article>;
}
