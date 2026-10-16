import type { CSSProperties } from 'react';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { useSearchParams } from 'react-router-dom';
import type { BadgeTone } from '../../../design/primitives';
import { Crest, FaceStack, SplitBar } from '../../../design/visuals';
import type { SquadSession } from '../../squadCommunication/api';
import type { ScheduleEventType } from '../../schedule/api';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { replies } from './useCoachData';
import type { CoachData } from './CoachWorkspace';
import '../day-agenda.css';
import './coach-hub.css';

/** One switch for every page: all my squads, or one of them. */
export function SquadSwitch({ data }: { data: CoachData }) {
    const [params, setParams] = useSearchParams();
    const copy = useCopy('coachHub', coachHubEn);
    if (data.mine.length < 2) return null;
    const pick = (id: number | null) => { const next = new URLSearchParams(params); if (id) next.set('squad', String(id)); else next.delete('squad'); ['event', 'q', 'view'].forEach(key => next.delete(key)); setParams(next); };
    return <div className="ch-switch" role="group" aria-label={copy('yourSquads')}>
        <button type="button" className="ch-switch__item" aria-pressed={data.focus === null} onClick={() => pick(null)}>{copy('allSquads')}</button>
        {data.mine.map(squad => <button key={squad.id} type="button" className="ch-switch__item" aria-pressed={data.focus === squad.id} onClick={() => pick(squad.id)}>
            <Crest src={data.clubLogo} name={data.clubName} size={18} />{squad.name}
        </button>)}
    </div>;
}

/** An activity's symbol on a soft tile of its colour. */
export function ActivityBadge({ kind, size = 30 }: { kind: ScheduleEventType; size?: number }) {
    const Icon = activityIcons[kind];
    return <span className="cw-agenda__icon" style={{ '--activity': activityColors[kind], width: size, height: size } as CSSProperties} aria-hidden="true"><Icon /></span>;
}

const toneOf = (session: SquadSession, response: string): BadgeTone | undefined =>
    response === 'GOING' ? 'accent' : response === 'NOT_GOING' ? 'danger' : response === 'UNSURE' ? 'info' : session.response_requested ? 'warning' : undefined;

/** The squad's faces for a session, each ringed by its answer: green coming, red can't, amber no reply. */
export function ReplyFaces({ session, max = 10, size = 26 }: { session: SquadSession; max?: number; size?: number }) {
    const order = { NOT_GOING: 0, UNANSWERED: 1, UNSURE: 2, GOING: 3 } as Record<string, number>;
    const people = replies(session).players.slice().sort((a, b) => (order[a.response] ?? 4) - (order[b.response] ?? 4))
        .map(player => ({ id: player.id, name: player.name, tone: toneOf(session, player.response) }));
    return <FaceStack people={people} max={max} size={size} />;
}

/** Who's coming as one bar and a short line: coming, can't come, no reply. */
export function ReplySummary({ session }: { session: SquadSession }) {
    const reply = replies(session), total = reply.players.length;
    if (session.status === 'CANCELLED') return <span className="ch-reply"><span className="ch-reply__text"><strong className="ch-reply__cancelled">Cancelled</strong></span></span>;
    const parts = reply.asked
        ? [{ value: reply.going, tone: 'accent' as const }, { value: reply.unsure, tone: 'info' as const }, { value: reply.none, tone: 'warning' as const }, { value: reply.cant, tone: 'danger' as const }]
        : [{ value: total - reply.cant - reply.unsure, tone: 'neutral' as const }, { value: reply.unsure, tone: 'info' as const }, { value: reply.cant, tone: 'danger' as const }];
    const headline = reply.asked ? `${reply.going} of ${total} coming` : reply.cant ? `${total - reply.cant} of ${total} expected` : 'Everyone expected';
    const detail = [reply.cant ? `${reply.cant} can’t come` : '', reply.unsure ? `${reply.unsure} unsure` : '', reply.asked && reply.none ? `${reply.none} no reply` : ''].filter(Boolean).join(' · ');
    return <span className="ch-reply">
        <SplitBar parts={parts} label={[headline, detail].filter(Boolean).join(', ')} />
        <span className="ch-reply__text"><strong>{headline}</strong>{detail && <span className={reply.asked && reply.none ? 'ch-reply__chase' : undefined}>{detail}</span>}</span>
    </span>;
}
