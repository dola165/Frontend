import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Pin } from 'lucide-react';
import { Badge, Chip, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import type { TabItem } from '../../../components/workspace/types';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { toolDescription, type OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { dayInline, timeLabel } from '../fixtures';
import { useNow } from '../useNow';
import '../club-workspace.css';

export type OverviewFocus = 'all' | 'mine' | `squad:${number}`;

/** Whole club, my squads, or one of my squads: what the overview counts and lists. */
export function FocusChips({ value, onChange, allLabel, mySquads }: { value: OverviewFocus; onChange: (value: OverviewFocus) => void; allLabel: string; mySquads: { id: number; name: string }[] }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    if (!mySquads.length) return null;
    return <div className="gk-chips" role="group" aria-label={copy('overviewShows')}>
        <Chip pressed={value === 'all'} onClick={() => onChange('all')}>{allLabel}</Chip>
        {mySquads.length > 1 && <Chip pressed={value === 'mine'} onClick={() => onChange('mine')}>{copy('mySquads')}</Chip>}
        {mySquads.map(squad => <Chip key={squad.id} pressed={value === `squad:${squad.id}`} onClick={() => onChange(`squad:${squad.id}`)}>{squad.name}</Chip>)}
    </div>;
}

/** Your approved responsibilities in one quiet line, with the way to change them. */
export function ResponsibilityLine({ roles, onManage }: { roles: RolesWorkspace; onManage: () => void }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const names = roles.views.filter(v => !['all', 'member'].includes(v.id)).map(v => v.label);
    const pending = roles.requests.some(r => r.status === 'PENDING' && r.user_id === roles.actorId);
    return <p className="cw-resp">
        <span className="cw-muted">{copy('yourResponsibilities')}</span> <strong>{names.join(', ') || copy('noneApproved')}</strong>
        {roles.invitations.length > 0 && <Badge tone="warning">{copy('invitationWaiting')}</Badge>}
        {pending && <Badge tone="info">{copy('requestWaiting')}</Badge>}
        <button type="button" className="cw-text-button" onClick={onManage}>{copy('change')}</button>
    </p>;
}

interface Suggestion { id: string; label: string; hint: string; icon: LucideIcon; open?: () => void; to?: string }

/** Pinned tools (the same pins as the top bar); until something is pinned, a few everyday suggestions. */
export function PinnedTools({ pinned, suggestions, onOpen, className }: { pinned: TabItem[]; suggestions: Suggestion[]; onOpen: OpenWorkspace; className?: string }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const tiles: Suggestion[] = pinned.length
        ? pinned.map(tab => ({ id: tab.id, label: tab.label, hint: toolDescription(tab), icon: tab.icon, open: () => onOpen(tab.id) }))
        : suggestions;
    return <Section className={className} title={copy('pinnedTools')} hint={pinned.length ? copy('pinsInTopBar') : copy('pinSuggestions')}
        action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('tools')}><Pin aria-hidden="true" />{pinned.length ? copy('editPins') : copy('pinTools')}</button>}>
        <ul className="cw-tiles" aria-label={pinned.length ? copy('pinnedTools') : copy('suggestedTools')}>
            {tiles.map(tile => {
                const Icon = tile.icon;
                const body = <><span className="cw-tile__icon"><Icon aria-hidden="true" /></span><span className="cw-tile__text"><strong>{tile.label}</strong><span>{tile.hint}</span></span></>;
                return <li key={tile.id}>{tile.to ? <Link className="cw-tile" to={tile.to}>{body}</Link> : <button type="button" className="cw-tile" onClick={tile.open}>{body}</button>}</li>;
            })}
        </ul>
    </Section>;
}

/** Squads in the current focus with their size and next training. */
export function SquadList({ squads, sessions, onOpen, title, className }: { squads: { id: number; name: string; player_count: number }[]; sessions: RolesWorkspace['sessions']; onOpen: OpenWorkspace; title: string; className?: string }) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const now = useNow();
    return <Section className={className} title={title} hint={squads.length ? `${squads.length}` : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('squads')}>{copy('allSquads')}</button>}>
        <Panel flush>{squads.length ? <List label={title}>{squads.map(squad => {
            const next = sessions.filter(s => s.squad_id === squad.id && new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
            return <ListRow key={squad.id} onClick={() => onOpen('squads', { squad: String(squad.id) })} title={squad.name}
                meta={next ? copy('nextTraining', { day: dayInline(next.starts_at, now), time: timeLabel(next.starts_at) }) : copy('noTraining')}
                trail={<span className="gk-num cw-count">{squad.player_count} <span className="cw-muted">{copy('playersWord', { count: squad.player_count })}</span></span>} />;
        })}</List> : <EmptyNote title={copy('noSquads')}>{copy('noSquadsHint')}</EmptyNote>}</Panel>
    </Section>;
}
