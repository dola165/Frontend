import { CalendarDays, ClipboardCheck, Goal, Users } from 'lucide-react';
import { Avatar, Button, EmptyNote, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { dayLabel, timeLabel } from '../fixtures';
import { canReadSquad } from './coachData';
import { useNow } from '../useNow';

/** One card per squad I coach: size, the next session, and the tools I use for it. */
export function CoachSquads({ roles, boot, squads, onOpen, onTakeOn }: { roles: RolesWorkspace; boot: Bootstrap | null; squads: number[]; onOpen: OpenWorkspace; onTakeOn: () => void }) {
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const now = useNow();
    if (!mine.length) return <Section title="My squads">
        <Panel><EmptyNote title="No squads are assigned to you" action={<Button size="sm" onClick={onTakeOn}>Take on a responsibility</Button>}>
            {roles.leadership ? 'You see the whole club through club administration. Ask for a squad responsibility to coach a team from here.' : 'Club leadership assigns squads to your responsibilities. Ask for one to start.'}
        </EmptyNote></Panel>
    </Section>;
    return <Section title="My squads" hint={`${mine.length} ${mine.length === 1 ? 'squad' : 'squads'}`}>
        <ul className="cw-squads" aria-label="My squads">{mine.map(squad => {
            const next = roles.sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            const context = { squad: String(squad.id) };
            return <li key={squad.id} className="cw-squad">
                <button type="button" className="cw-squad__head" onClick={() => onOpen('squads', context)}>
                    <Avatar name={squad.name} size={40} square />
                    <span className="cw-squad__name"><strong>{squad.name}</strong><span>{squad.player_count} {squad.player_count === 1 ? 'player' : 'players'}</span></span>
                </button>
                <p className="cw-squad__next">{next
                    ? <><CalendarDays aria-hidden="true" /><span>Next: <strong className="gk-num">{timeLabel(next.starts_at)}</strong> {dayLabel(next.starts_at)} · {next.title}</span></>
                    : <><CalendarDays aria-hidden="true" /><span>No training planned in the next 14 days</span></>}</p>
                <div className="cw-squad__links">
                    <Button size="sm" variant="ghost" onClick={() => onOpen('squads', context)}><Users aria-hidden="true" />Players</Button>
                    <Button size="sm" variant="ghost" onClick={() => onOpen('squads', { ...context, view: 'training', ...(next ? { session: String(next.id) } : {}) })}><CalendarDays aria-hidden="true" />Training</Button>
                    {canReadSquad(boot, 'ATTENDANCE', squad.id) && <Button size="sm" variant="ghost" onClick={() => onOpen('attendance', context)}><ClipboardCheck aria-hidden="true" />Attendance</Button>}
                    {canReadSquad(boot, 'DEVELOPMENT', squad.id) && <Button size="sm" variant="ghost" onClick={() => onOpen('development', context)}><Goal aria-hidden="true" />Development</Button>}
                </div>
            </li>;
        })}</ul>
    </Section>;
}
