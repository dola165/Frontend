import { CalendarDays, ClipboardCheck, Goal, Users } from 'lucide-react';
import { Avatar, Button, EmptyNote, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { canReadSquad } from '../../clubOperations/squadAccess';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, timeLabel } from '../fixtures';
import { useNow } from '../useNow';
import '../club-workspace.css';

/** One card per squad I coach: size, the next session, and the tools I use for it. */
export function CoachSquads({ roles, boot, squads, hidden, onShowAll, onOpen, onTakeOn }: {
    roles: RolesWorkspace; boot: Bootstrap | null; squads: number[];
    /** Some of the person's squads are left out because their responsibility is switched off. */
    hidden: boolean; onShowAll: () => void; onOpen: OpenWorkspace; onTakeOn: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const now = useNow();
    const showAll = hidden && <Button size="sm" variant="ghost" onClick={onShowAll}>{copy('showAll')}</Button>;
    if (!mine.length) return <Section title={copy('mySquads')}>
        <Panel><EmptyNote title={copy('noSquads')} action={hidden ? <Button size="sm" onClick={onShowAll}>{copy('showAll')}</Button> : <Button size="sm" onClick={onTakeOn}>{copy('takeOn')}</Button>}>
            {hidden ? copy('focusHidden') : roles.leadership ? copy('noSquadsLeadership') : copy('noSquadsStaff')}
        </EmptyNote></Panel>
    </Section>;
    return <Section title={copy('mySquads')} hint={copy('squads', { count: mine.length })} action={showAll || undefined}>
        <ul className="cw-squads" aria-label={copy('mySquads')}>{mine.map(squad => {
            const next = roles.sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            const context = { squad: String(squad.id) };
            return <li key={squad.id} className="cw-squad">
                <button type="button" className="cw-squad__head" onClick={() => onOpen('squads', context)}>
                    <Avatar name={squad.name} size={40} square />
                    <span className="cw-squad__name"><strong>{squad.name}</strong><span>{copy('playerCount', { count: squad.player_count })}</span></span>
                </button>
                <p className="cw-squad__next"><CalendarDays aria-hidden="true" />{next
                    ? <span>{copy('nextTraining', { time: timeLabel(next.starts_at), day: dayLabel(next.starts_at, now), name: next.title })}</span>
                    : <span>{copy('noTraining')}</span>}</p>
                <div className="cw-squad__links">
                    <Button size="sm" variant="ghost" onClick={() => onOpen('squads', context)}><Users aria-hidden="true" />{copy('players')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => onOpen('squads', { ...context, view: 'training', ...(next ? { session: String(next.id) } : {}) })}><CalendarDays aria-hidden="true" />{copy('training')}</Button>
                    {canReadSquad(boot, 'ATTENDANCE', squad.id) && <Button size="sm" variant="ghost" onClick={() => onOpen('attendance', context)}><ClipboardCheck aria-hidden="true" />{copy('attendance')}</Button>}
                    {canReadSquad(boot, 'DEVELOPMENT', squad.id) && <Button size="sm" variant="ghost" onClick={() => onOpen('development', context)}><Goal aria-hidden="true" />{copy('development')}</Button>}
                </div>
            </li>;
        })}</ul>
    </Section>;
}
