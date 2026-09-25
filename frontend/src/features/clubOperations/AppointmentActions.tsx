import { useEffect,useState } from 'react';
import { get,root,appointmentStatus,type Appointment } from './api';
export function AppointmentActions({club,onOpen}:{club:number;onOpen:()=>void}) {
  const [items,setItems]=useState<Appointment[]>([]),[error,setError]=useState('');
  useEffect(()=>{const c=new AbortController();void get<Appointment[]>(`${root(club)}/appointments`,c.signal).then(r=>{if(!c.signal.aborted)setItems(r);}).catch(()=>{if(!c.signal.aborted)setError('Staff appointment actions could not be loaded.');});return()=>c.abort();},[club]);
  const [upcoming]=useState(()=>new Date(Date.now()+30*86400000).toISOString().slice(0,10));
  const actions=items.filter(a=>a.status==='INVITED'||a.status==='ACTIVE'&&a.ends_on&&a.ends_on<=upcoming);
  return error?<p role="alert">{error}</p>:actions.length?<section className="ops-card ops-editor"><h3>Staff assignments needing attention</h3>{actions.map(a=><div key={a.id} className="ops-history"><strong>{a.name} · {a.title}</strong><p className="ops-muted">{appointmentStatus(a)}{a.ends_on?` · Ends ${a.ends_on}`:' · Awaiting the person’s decision'}</p></div>)}<button onClick={onOpen}>Manage staff appointments</button></section>:null;
}
