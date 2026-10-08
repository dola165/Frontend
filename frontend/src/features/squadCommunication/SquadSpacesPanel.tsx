import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight,MessageCircle,Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { spaces,overview,type SquadOverview,type SquadSpace } from './api';
import './squad-communication.css';
import {SquadCoachIdentity} from './SquadCoachIdentity';

export function SquadSpacesPanel({clubId,compact=false}:{clubId?:number;compact?:boolean}) {
 const {sessionId}=useAuth();
 return <SquadSpacesContent key={`${sessionId}:${clubId??'all'}`} clubId={clubId} compact={compact}/>;
}
function SquadSpacesContent({clubId,compact}:{clubId?:number;compact:boolean}) {
 const [details,setDetails]=useState<Record<number,SquadOverview>>({});
 const [rows,setRows]=useState<SquadSpace[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const abort=new AbortController();let active=true;
  void spaces(abort.signal).then(async data=>{if(!active)return;const visible=data.filter(s=>clubId==null||s.club_id===clubId);setRows(visible);setError(false);const results=await Promise.allSettled(visible.map(s=>overview(s.id,abort.signal)));if(active)setDetails(Object.fromEntries(results.flatMap(r=>r.status==='fulfilled'?[[r.value.id,r.value]]:[])));}).catch(()=>{if(active)setError(true);});
  return()=>{active=false;abort.abort();};
 },[clubId,retry]);
 return <section className="squad-home" aria-label="My squads">
  <div className="squad-section-heading"><div><span className="squad-eyebrow"><Users size={16}/> YOUR SQUADS</span><h2>{compact?'Stay close to your squad':'Your team starts here'}</h2><p>Coach updates, conversations and the next training session.</p></div>{compact&&<Link to="/squads">All my squads <ArrowUpRight size={16}/></Link>}</div>
  {error?<p role="alert">Squad spaces could not load. <button onClick={()=>setRetry(v=>v+1)}>Try again</button></p>:!rows?<p role="status">Loading your squads…</p>:rows.length===0?<div className="squad-empty"><MessageCircle/><h3>Your squad belongs here</h3><p>Ask your coach to link your child’s player card and confirm parental consent. Players appear after joining a squad; coaches after an academy club assigns them.</p></div>:<div className="squad-space-grid">{rows.map(s=><Link className="squad-space-card" key={s.id} to={`/squads/${s.id}`}><div className="squad-space-top"><span><Users size={20}/></span>{s.unread_count>0&&<b className="squad-count">{s.unread_count} unread</b>}</div><small>{s.academy_name} · Academy club</small><h3>{s.name}</h3>{details[s.id]?<SquadCoachIdentity space={details[s.id]}/>:<p>Open squad for coaching details</p>}<span className="squad-space-open">Open squad <ArrowUpRight size={18}/></span></Link>)}</div>}
 </section>;
}
