import { useState } from 'react';
import { Avatar, Button, Chip, EmptyNote, List, ListRow, Panel, SearchInput } from '../../../design/primitives';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { WorkspacePlayerPanel } from '../../clubOperations/WorkspacePlayerPanel';

type Person = RolesWorkspace['people'][number];

/** Every player in my squads, searchable, each opening their notes, restrictions and tools. */
export function CoachPlayers({ roles, boot, squads, onOpen }: { roles: RolesWorkspace; boot: Bootstrap | null; squads: number[]; onOpen: OpenWorkspace }) {
    const [query, setQuery] = useState(''), [squad, setSquad] = useState<number | null>(null), [player, setPlayer] = useState<Person | null>(null);
    const mine = roles.squads.filter(s => squads.includes(s.id));
    const needle = query.trim().toLocaleLowerCase();
    const people = roles.people.filter(p => squads.includes(p.squad_id) && (squad === null || p.squad_id === squad) && (!needle || p.name.toLocaleLowerCase().includes(needle)))
        .sort((a, b) => a.squad_name.localeCompare(b.squad_name) || a.name.localeCompare(b.name));
    if (!mine.length) return <Panel><EmptyNote title="No squads are assigned to you">Players appear here once a club admin assigns you a squad.</EmptyNote></Panel>;
    return <div className="gk-stack gk-stack--tight">
        <div className="cw-toolbar">
            <SearchInput className="cw-toolbar__search" aria-label="Find a player" placeholder="Find a player" value={query} onChange={event => setQuery(event.target.value)} />
            {mine.length > 1 && <div className="gk-chips" role="group" aria-label="Squad">
                <Chip pressed={squad === null} onClick={() => setSquad(null)}>All my squads</Chip>
                {mine.map(s => <Chip key={s.id} pressed={squad === s.id} onClick={() => setSquad(s.id)}>{s.name}</Chip>)}
            </div>}
            <span className="cw-muted cw-toolbar__count" role="status">{people.length} {people.length === 1 ? 'player' : 'players'}</span>
        </div>
        <Panel flush>{people.length ? <List label="My players">{people.map(p => <ListRow key={`${p.id}-${p.squad_id}`} lead={<Avatar name={p.name} size={36} />}
            title={p.name} meta={p.squad_name} onClick={() => setPlayer(p)} trail={<span className="cw-muted">Notes and tools</span>} />)}</List>
            : <EmptyNote title="No players match" action={<Button size="sm" onClick={() => { setQuery(''); setSquad(null); }}>Clear filters</Button>}>Try another name or squad.</EmptyNote>}</Panel>
        {player && <WorkspacePlayerPanel key={`${player.id}-${player.squad_id}`} player={player} squad={player.squad_id} squadName={player.squad_name} boot={boot} onClose={() => setPlayer(null)} onOpen={onOpen} />}
    </div>;
}
