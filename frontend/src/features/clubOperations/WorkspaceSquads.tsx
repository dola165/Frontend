import { useState } from 'react';
import { ArrowLeft, ArrowRight, Search, Shield, Users } from 'lucide-react';
import type { RolesWorkspace } from './useWorkspaceRoles';
import type { Bootstrap } from './api';
import type { OpenWorkspace } from './WorkspaceHome';
import { SquadWorkbench, WorkspacePlayerPanel } from './SquadWorkbench';
import '../../components/squads/squad-design.css';

export function WorkspaceSquads({data,boot,squad,onSquad,onOpen,playersOnly=false}:{data:RolesWorkspace;boot:Bootstrap|null;squad:string;onSquad:(id:string)=>void;onOpen:OpenWorkspace;canManage:boolean;playersOnly?:boolean}) {
  const [query,setQuery]=useState(''),[player,setPlayer]=useState<RolesWorkspace['people'][number]|null>(null);
  const selected=data.squads.find(s=>String(s.id)===squad);
  const people=data.people.filter(p=>(!selected||p.squad_id===selected.id)&&p.name.toLowerCase().includes(query.toLowerCase()));
  const roster=<section className="wo-scoped-roster"><div className="sd-toolbar"><label className="sd-search"><Search size={16}/><input aria-label="Find a player" placeholder="Find a player…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{playersOnly&&<select className="sd-select" aria-label="Player squad" value={squad} onChange={e=>onSquad(e.target.value)}><option value="">All my squads</option>{data.squads.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select>}<span className="sd-muted">{people.length} shown</span></div>{people.map(p=><button type="button" className="wo-scoped-player" key={`${p.id}-${p.squad_id}`} onClick={()=>setPlayer(p)}><span className="work-person-avatar" aria-hidden>{p.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('')}</span><span><strong>{p.name}</strong><small>{p.squad_name}</small></span><span>Player details<ArrowRight size={14}/></span></button>)}{!people.length&&<p className="wo-quiet">{query?'No players match your search.':'No players are shared with you in this squad.'}</p>}{data.people.length>=1500&&<p className="wo-quiet">Showing the first 1,500 squad memberships.</p>}</section>;
  return <section className="squad-design work-squads">
    {selected&&!playersOnly&&<button className="work-back" onClick={()=>onSquad('')}><ArrowLeft size={15}/>All squads</button>}
    <header className="sd-heading"><div><span className="sd-eyebrow">Club football</span><h1>{playersOnly?'Players':selected?.name??'Squads'}<span aria-hidden="true" className="club-overview-dot">.</span></h1><p>{selected?`${selected.player_count} players · Your squad, ready for the next session.`:'Your teams, their players and the work you share.'}</p></div></header>
    {!selected&&!playersOnly?<div className="wo-assigned-squads">{data.squads.map(s=><button type="button" key={s.id} onClick={()=>onSquad(String(s.id))}><Shield size={24}/><span><strong>{s.name}</strong><small>{s.player_count} players</small></span><ArrowRight size={18}/></button>)}{!data.squads.length&&<p className="wo-quiet"><Users size={24}/>Your assigned squads will appear here.</p>}</div>:selected&&!playersOnly?<div className="sd-panel"><SquadWorkbench data={data} boot={boot} squad={selected.id} onOpen={onOpen}>{roster}</SquadWorkbench></div>:roster}
    {player&&<WorkspacePlayerPanel key={`${player.id}-${player.squad_id}`} player={player} squad={player.squad_id} squadName={player.squad_name} boot={boot} onClose={()=>setPlayer(null)} onOpen={onOpen}/>}
  </section>;
}
