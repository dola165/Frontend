import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Avatar, Button, EmptyNote, List, ListRow, PageFrame, PageHeader, Panel, SearchInput } from '../../design/primitives';
import type { RolesWorkspace } from './useWorkspaceRoles';
import type { Bootstrap } from './api';
import type { OpenWorkspace } from './workspaceStructure';
import { SquadWorkbench } from './SquadWorkbench';
import { WorkspacePlayerPanel } from './WorkspacePlayerPanel';
import './records/records.css';

type Person = RolesWorkspace['people'][number];

/** The squads shared with a coach who does not manage the club: pick one, then its players and training. */
export function WorkspaceSquads({ data, boot, squad, onSquad, onOpen }: { data: RolesWorkspace; boot: Bootstrap | null; squad: string; onSquad: (id: string) => void; onOpen: OpenWorkspace }) {
  const [query, setQuery] = useState(''), [player, setPlayer] = useState<Person | null>(null);
  const selected = data.squads.find(s => String(s.id) === squad);
  const people = data.people.filter(p => selected && p.squad_id === selected.id && p.name.toLowerCase().includes(query.toLowerCase()));
  if (!selected) return <PageFrame className="rec-page">
    <PageHeader title="Squads" subtitle="The squads shared with your responsibilities." />
    <Panel flush>{data.squads.length ? <List label="Your squads">{data.squads.map(s => <ListRow key={s.id} lead={<Avatar name={s.name} size={40} square />} title={s.name}
      meta={`${s.player_count} ${s.player_count === 1 ? 'player' : 'players'}`} onClick={() => onSquad(String(s.id))} />)}</List>
      : <EmptyNote title="No squads are shared with you yet">Club leadership assigns squads to your responsibilities.</EmptyNote>}</Panel>
  </PageFrame>;
  return <PageFrame className="rec-page">
    <div className="rec-back"><Button variant="ghost" size="sm" onClick={() => onSquad('')}><ArrowLeft aria-hidden="true" />All squads</Button></div>
    <PageHeader title={selected.name} subtitle={`${selected.player_count} ${selected.player_count === 1 ? 'player' : 'players'}`} />
    <SquadWorkbench data={data} boot={boot} squad={selected.id} onOpen={onOpen}>
      <div className="gk-stack gk-stack--tight">
        <div className="rec-toolbar"><SearchInput className="rec-toolbar__search" aria-label="Find a player" placeholder="Find a player" value={query} onChange={e => setQuery(e.target.value)} /><span className="rec-toolbar__count" role="status">{people.length} shown</span></div>
        <Panel flush>{people.length ? <List label="Players">{people.map(p => <ListRow key={`${p.id}-${p.squad_id}`} lead={<Avatar name={p.name} size={36} />} title={p.name} meta={p.squad_name} trail="Player details" onClick={() => setPlayer(p)} />)}</List>
          : <EmptyNote title={query ? 'No players match your search' : 'No players are shared with you in this squad'} />}</Panel>
        {data.people.length >= 1500 && <p className="gk-faint">Showing the first 1,500 squad memberships.</p>}
      </div>
    </SquadWorkbench>
    {player && <WorkspacePlayerPanel key={`${player.id}-${player.squad_id}`} player={player} squad={player.squad_id} squadName={player.squad_name} boot={boot} onClose={() => setPlayer(null)} />}
  </PageFrame>;
}
