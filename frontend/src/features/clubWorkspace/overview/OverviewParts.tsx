import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Pin } from 'lucide-react';
import { Badge, Chip, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { TabItem } from '../../../components/workspace/types';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { toolDescription, type OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { dayLabel, timeLabel } from '../fixtures';
import { useNow } from '../useNow';

export type OverviewFocus = 'all' | 'mine' | `squad:${number}`;

/** Whole club, my squads, or one of my squads: what the overview counts and lists. */
export function FocusChips({ value, onChange, allLabel, mySquads }: { value: OverviewFocus; onChange: (value: OverviewFocus) => void; allLabel: string; mySquads: { id: number; name: string }[] }) {
    if (!mySquads.length) return null;
    return <div className="gk-chips" role="group" aria-label="Overview shows">
        <Chip pressed={value === 'all'} onClick={() => onChange('all')}>{allLabel}</Chip>
        {mySquads.length > 1 && <Chip pressed={value === 'mine'} onClick={() => onChange('mine')}>My squads</Chip>}
        {mySquads.map(squad => <Chip key={squad.id} pressed={value === `squad:${squad.id}`} onClick={() => onChange(`squad:${squad.id}`)}>{squad.name}</Chip>)}
    </div>;
}

/** Your approved responsibilities in one quiet line, with the way to change them. */
export function ResponsibilityLine({ roles, onManage }: { roles: RolesWorkspace; onManage: () => void }) {
    const names = roles.views.filter(v => !['all', 'member'].includes(v.id)).map(v => v.label);
    const pending = roles.requests.some(r => r.status === 'PENDING' && r.user_id === roles.actorId);
    return <p className="cw-resp">
        <span className="cw-muted">Your responsibilities:</span> <strong>{names.join(', ') || 'none approved yet'}</strong>
        {roles.invitations.length > 0 && <Badge tone="warning">Invitation waiting</Badge>}
        {pending && <Badge tone="info">Request awaiting approval</Badge>}
        <button type="button" className="cw-text-button" onClick={onManage}>Change</button>
    </p>;
}

interface Suggestion { id: string; label: string; hint: string; icon: LucideIcon; open?: () => void; to?: string }

/** Pinned tools (the same pins as the top bar); until something is pinned, a few everyday suggestions. */
export function PinnedTools({ pinned, suggestions, onOpen }: { pinned: TabItem[]; suggestions: Suggestion[]; onOpen: OpenWorkspace }) {
    const tiles: Suggestion[] = pinned.length
        ? pinned.map(tab => ({ id: tab.id, label: tab.label, hint: toolDescription(tab), icon: tab.icon, open: () => onOpen(tab.id) }))
        : suggestions;
    return <Section title="Pinned tools" hint={pinned.length ? 'Also in your top bar' : 'Suggestions until you pin your own'}
        action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('tools')}><Pin aria-hidden="true" />{pinned.length ? 'Edit pins' : 'Pin tools'}</button>}>
        <ul className="cw-tiles" aria-label={pinned.length ? 'Pinned tools' : 'Suggested tools'}>
            {tiles.map(tile => {
                const Icon = tile.icon;
                const body = <><span className="cw-tile__icon"><Icon aria-hidden="true" /></span><span className="cw-tile__text"><strong>{tile.label}</strong><span>{tile.hint}</span></span></>;
                return <li key={tile.id}>{tile.to ? <Link className="cw-tile" to={tile.to}>{body}</Link> : <button type="button" className="cw-tile" onClick={tile.open}>{body}</button>}</li>;
            })}
        </ul>
    </Section>;
}

/** Squads in the current focus with their size and next training. */
export function SquadList({ squads, sessions, onOpen, title }: { squads: { id: number; name: string; player_count: number }[]; sessions: RolesWorkspace['sessions']; onOpen: OpenWorkspace; title: string }) {
    const now = useNow();
    return <Section title={title} hint={squads.length ? `${squads.length}` : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('squads')}>All squads</button>}>
        <Panel flush>{squads.length ? <List label={title}>{squads.map(squad => {
            const next = sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            return <ListRow key={squad.id} onClick={() => onOpen('squads', { squad: String(squad.id) })} title={squad.name}
                meta={next ? `Next training ${dayLabel(next.starts_at).toLowerCase() === 'today' ? 'today' : dayLabel(next.starts_at)} at ${timeLabel(next.starts_at)}` : 'No training in the next 14 days'}
                trail={<span className="gk-num cw-count">{squad.player_count} <span className="cw-muted">{squad.player_count === 1 ? 'player' : 'players'}</span></span>} />;
        })}</List> : <EmptyNote title="No squads yet">Squads assigned to you appear here.</EmptyNote>}</Panel>
    </Section>;
}
