import { CalendarDays, MessageCircle, Shield } from 'lucide-react';
import { Button, ButtonLink, Count, EmptyNote, Panel, Section } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import { dayLabel, timeLabel } from '../fixtures';
import { useNow } from '../useNow';
import '../club-workspace.css';

/** One card per squad I coach: my role, size, the next session; open the squad or talk to its families. */
export function CoachSquads({ title, roleOf, families, roles, squads, hidden, onShowAll, onOpen, onTakeOn }: {
    title?: string; roleOf?: (squadId: number) => string; families?: Map<number, number>;
    roles: RolesWorkspace; boot: Bootstrap | null; squads: number[];
    /** Some of the person's squads are left out because their responsibility is switched off. */
    hidden: boolean; onShowAll: () => void; onOpen: OpenWorkspace; onTakeOn: () => void;
}) {
    const copy = useCopy('coachHub', coachHubEn);
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const now = useNow();
    const showAll = hidden && <Button size="sm" variant="ghost" onClick={onShowAll}>{copy('showAll')}</Button>;
    if (!mine.length) return <Section icon={Shield} tone="accent" title={title ?? copy('mySquads')}>
        <Panel><EmptyNote title={copy('noSquads')} action={hidden ? <Button size="sm" onClick={onShowAll}>{copy('showAll')}</Button> : <Button size="sm" onClick={onTakeOn}>{copy('takeOn')}</Button>}>
            {hidden ? copy('focusHidden') : roles.leadership ? copy('noSquadsLeadership') : copy('noSquadsStaff')}
        </EmptyNote></Panel>
    </Section>;
    return <Section icon={Shield} tone="accent" title={title ?? copy('mySquads')} hint={copy('squads', { count: mine.length })} action={showAll || undefined}>
        <ul className="cw-squads" aria-label={copy('mySquads')}>{mine.map(squad => {
            const next = roles.sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            const context = { squad: String(squad.id) };
            return <li key={squad.id} className="cw-squad">
                <button type="button" className="cw-squad__head" onClick={() => onOpen('squads', context)}>
                    <span className="cw-squad__name"><strong>{squad.name}</strong><span>{[roleOf?.(squad.id), copy('playerCount', { count: squad.player_count })].filter(Boolean).join(" · ")}</span></span>
                </button>
                <p className="cw-squad__next"><CalendarDays aria-hidden="true" />{next
                    ? <span>{copy('nextTraining', { time: timeLabel(next.starts_at), day: dayLabel(next.starts_at, now), name: next.title })}</span>
                    : <span>{copy('noTraining')}</span>}</p>
                <div className="cw-squad__links">
                    <Button size="sm" onClick={() => onOpen('squads', context)}>{copy('openSquad')}</Button>
                    <ButtonLink size="sm" variant="ghost" to={`/squads/${squad.id}`}><MessageCircle aria-hidden="true" />{copy('families')}<Count value={families?.get(squad.id) ?? 0} /></ButtonLink>
                </div>
            </li>;
        })}</ul>
    </Section>;
}
