import { EmptyState } from '../../components/ui/EmptyState';
import { Flag, Check } from 'lucide-react';
import { useRefereeHistory } from './useRefereeHistory';
import type { Referee } from './api';
import './club-referees.css';

export function ClubRefereeChoices({squadId,volunteer,selectedId,onSelect}:{squadId?:number|null;volunteer:boolean;selectedId:number;onSelect:(referee:Referee)=>void}){
  const {data,error,reload}=useRefereeHistory<Referee[]>(squadId?`/referees/club-squad/${squadId}`:'');
  if(!squadId)return null;
  return <section className="club-referee-choices mx-wide"><header><Flag size={19}/><div><h3>Your club’s referees</h3><p>Active club appointments for this squad. Choose a referee to invite.</p></div></header>
    {error?<p role="alert">Could not load your club referees. <button type="button" onClick={reload}>Retry</button></p>:!data?<p role="status">Loading club referees…</p>:!data.length?<EmptyState compact icon={Flag} title="No club referee is ready for invitations yet" description="A referee needs an accepted, current club appointment and a published profile to appear here. You can also search the referee directory below."/>:<div>{data.map(r=>{const eligible=volunteer?r.accepts_volunteer:r.accepts_paid;return <button type="button" key={r.user_id} aria-pressed={selectedId===r.user_id} disabled={!eligible} onClick={()=>onSelect(r)}><Flag size={18}/><span><strong>{r.full_name}</strong><small>{r.service_area}{eligible?` · ${volunteer?'Accepts volunteer matches':`${r.fee} ${r.currency} listed fee`}`:' · Does not accept these terms'}</small></span>{selectedId===r.user_id?<Check size={18}/>:<span>Select</span>}</button>;})}</div>}
    <small>Affiliation does not confirm a fixture. The referee accepts the invitation after checking availability.</small>
  </section>;
}
