import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, FixtureRow, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import type { ParentHub } from '../../parents/api';
import type { SquadMessage, SquadSession, SquadSpace } from '../../squadCommunication/api';
import { dayLabel, timeLabel } from '../../clubWorkspace/fixtures';
import { formatDate } from '../../../utils/formatting';
import { useOverviewSource } from '../useOverviewSource';

/** For a parent with children at this club: their squads' next sessions and coach updates. Every source enforces its own access. */
export function ClubFamilyWeek({ clubId }: { clubId: number }) {
    const family = useOverviewSource<ParentHub>('/parents/hub');
    const spaces = useOverviewSource<SquadSpace[]>('/squad-communication');
    const children = family.data?.children.filter(child => child.clubId === clubId) ?? [];
    const squads = spaces.data?.filter(s => s.club_id === clubId && children.some(c => c.squadNames.includes(s.name))) ?? [];
    const sources = [family, spaces];
    const names = children.map(child => child.fullName).filter(Boolean).join(', ');
    return <Section title="Your family this week" hint={names || undefined} action={{ label: 'Parent Hub', to: '/parent' }}>
        {sources.some(s => s.failed) ? <div className="gk-notice gk-notice--danger" role="alert"><span>Your family’s week couldn’t load.</span><Button size="sm" onClick={() => sources.filter(s => s.failed).forEach(s => s.retry())}>Try again</Button></div>
            : sources.some(s => s.loading) ? <Skeleton height={96} />
            : squads.length ? squads.map(squad => <FamilySquad key={squad.id} squad={squad} childIds={children.map(c => c.userId)} />)
            : <Panel><EmptyNote title="No squad sessions to show yet">Your child’s squad sessions and coach updates appear here once the club links them to a squad.</EmptyNote></Panel>}
    </Section>;
}

function FamilySquad({ squad, childIds }: { squad: SquadSpace; childIds: number[] }) {
    const [window] = useState(() => { const start = new Date(), end = new Date(start); end.setDate(end.getDate() + 14); return `from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`; });
    const sessions = useOverviewSource<SquadSession[]>(`/squad-communication/${squad.id}/sessions?${window}`);
    const messages = useOverviewSource<SquadMessage[]>(`/squad-communication/${squad.id}/messages?kind=ANNOUNCEMENT`);
    const [now] = useState(() => Date.now());
    const upcoming = [...(sessions.data ?? [])].filter(s => Date.parse(s.ends_at) >= now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(0, 3);
    const updates = [...(messages.data ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 2);
    const cantCome = (session: SquadSession) => session.attendance.some(p => childIds.includes(p.id) && p.response === 'NOT_GOING');
    const confirm = (session: SquadSession) => session.attendance.some(p => childIds.includes(p.id) && (p.response_status === 'RECONFIRMATION_REQUIRED' || (session.response_requested === true && p.response === 'UNANSWERED')));
    return <Panel flush title={squad.name} action={<Link className="gk-section__action" to={`/squads/${squad.id}?tab=sessions`}>Squad schedule</Link>}>
        {sessions.failed ? <EmptyNote title="Sessions couldn’t load" action={<Button size="sm" onClick={sessions.retry}>Try again</Button>} />
            : sessions.loading ? <div className="gk-panel--pad"><Skeleton height={56} /></div>
            : upcoming.length ? <List label={`${squad.name} next sessions`}>{upcoming.map(s => <FixtureRow key={s.id} tone={s.event_type === 'MATCH' || s.event_type === 'FRIENDLY' ? 'match' : 'training'}
                time={timeLabel(s.starts_at)} day={dayLabel(s.starts_at)} title={s.title} to={`/squads/${squad.id}?tab=sessions&sessionId=${s.id}&at=${encodeURIComponent(s.starts_at)}`}
                meta={s.status === 'CANCELLED' ? `Cancelled${s.cancellation_reason ? ` · ${s.cancellation_reason}` : ''}` : s.location || 'Place to be confirmed'}
                trail={s.status === 'CANCELLED' ? <Badge tone="danger">Cancelled</Badge> : confirm(s) ? <Badge tone="warning">Please confirm</Badge> : cantCome(s) ? <Badge>Can’t come</Badge> : undefined} />)}</List>
            : <EmptyNote title="No sessions in the next 14 days" />}
        {!messages.failed && !messages.loading && updates.length > 0 && <List label={`${squad.name} coach updates`}>{updates.map(m => <ListRow key={m.id} to={`/squads/${squad.id}?tab=announcements`}
            title={m.title || `Update from ${m.author_name}`} meta={`${formatDate(m.created_at, { day: 'numeric', month: 'short' })} · ${m.body}`}
            trail={m.acknowledgement_requested && !m.acknowledged_at ? <Badge tone="warning">Read and confirm</Badge> : m.important ? <Badge tone="warning">Important</Badge> : undefined} />)}</List>}
    </Panel>;
}
