import { useState } from 'react';
import { Avatar, Button, Chip, EmptyNote, List, ListRow, Panel, SearchInput } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';
import { coachHubEn } from '../../../locales/workspaceDesign';
import { useCopy } from '../../../locales/useCopy';
import '../club-workspace.css';

type Person = RolesWorkspace['people'][number];

/** Every player in my squads, searchable, each opening their notes, restrictions and tools. */
export function CoachPlayers({ roles, boot, squads, hidden, onShowAll, onOpen }: { roles: RolesWorkspace; boot: Bootstrap | null; squads: number[]; hidden: boolean; onShowAll: () => void; onOpen: OpenWorkspace }) {
    const copy = useCopy('coachHub', coachHubEn);
    const [query, setQuery] = useState(''), [squad, setSquad] = useState<number | null>(null), [player, setPlayer] = useState<Person | null>(null);
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const needle = query.trim().toLocaleLowerCase();
    const people = roles.people.filter(p => squads.includes(p.squad_id) && (squad === null || p.squad_id === squad) && (!needle || p.name.toLocaleLowerCase().includes(needle)))
        .sort((a, b) => a.squad_name.localeCompare(b.squad_name) || a.name.localeCompare(b.name));
    if (!mine.length) return <Panel><EmptyNote title={copy('noSquads')} action={hidden ? <Button size="sm" onClick={onShowAll}>{copy('showAll')}</Button> : undefined}>{hidden ? copy('focusHidden') : copy('noPlayersYet')}</EmptyNote></Panel>;
    return <div className="gk-stack gk-stack--tight">
        <div className="cw-toolbar">
            <SearchInput className="cw-toolbar__search" aria-label={copy('findPlayer')} placeholder={copy('findPlayer')} value={query} onChange={event => setQuery(event.target.value)} />
            {mine.length > 1 && <div className="gk-chips" role="group" aria-label={copy('squadFilter')}>
                <Chip pressed={squad === null} onClick={() => setSquad(null)}>{copy('allMySquads')}</Chip>
                {mine.map(s => <Chip key={s.id} pressed={squad === s.id} onClick={() => setSquad(s.id)}>{s.name}</Chip>)}
            </div>}
            <span className="cw-muted cw-toolbar__count" role="status">{copy('playerCount', { count: people.length })}</span>
        </div>
        <Panel flush>{people.length ? <List label={copy('tabPlayers')}>{people.map(p => <ListRow key={`${p.id}-${p.squad_id}`} lead={<Avatar name={p.name} size={36} />}
            title={p.name} meta={p.squad_name} onClick={() => setPlayer(p)} trail={<span className="cw-muted">{copy('notesAndTools')}</span>} />)}</List>
            : <EmptyNote title={copy('noPlayersMatch')} action={<Button size="sm" onClick={() => { setQuery(''); setSquad(null); }}>{copy('clearFilters')}</Button>}>{copy('noPlayersMatchHint')}</EmptyNote>}</Panel>
        {player && <WorkspacePlayerPanel key={`${player.id}-${player.squad_id}`} player={player} squad={player.squad_id} squadName={player.squad_name} boot={boot} onClose={() => setPlayer(null)} onOpen={onOpen} />}
    </div>;
}
