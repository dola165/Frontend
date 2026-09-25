import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { get,label,moduleNames } from './api';
interface Readiness { clubId:number;clubName:string;canReadPreparation:boolean;records:{id:number;title:string;module:string;status:string;due_on:string|null;reviewOn:string|null}[] }
export function MatchReadiness({event}:{event:number}) {
  const [data,setData]=useState<Readiness[]|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const c=new AbortController();void get<Readiness[]>(`/club-operations/matches/${event}/readiness`,c.signal).then(r=>{if(!c.signal.aborted){setData(r);setError('');}}).catch(()=>{if(!c.signal.aborted)setError('Club preparation records could not be loaded.');});return()=>c.abort();},[event,attempt]);
  if(data?.length===0&&!error)return null;
  return <section className="mx-panel"><h2>Club preparation</h2><p className="mx-muted">Linked club records within your access. Each club remains responsible for checking its team and arrangements.</p>{error&&<p role="alert">{error}<button onClick={()=>setAttempt(v=>v+1)}>Retry</button></p>}{!data&&!error&&<p role="status">Loading preparation…</p>}{data?.map(c=><div key={c.clubId}><h3>{c.clubName}</h3>{c.records.map(r=><article className="mx-row" key={r.id}><div><Link to={`/clubs/${c.clubId}/operations?module=${r.module}&record=${r.id}`}>{r.title}</Link><p className="mx-muted">{moduleNames[r.module]} · {label(r.status)}{(r.reviewOn||r.due_on)&&` · Review / due ${r.reviewOn||r.due_on}`}</p></div></article>)}{!c.records.length&&<p className="mx-muted">No linked records are available in your view.</p>}{c.canReadPreparation&&<Link className="mx-button" to={`/clubs/${c.clubId}/operations?module=READINESS`}>Manage preparation →</Link>}</div>)}</section>;
}
