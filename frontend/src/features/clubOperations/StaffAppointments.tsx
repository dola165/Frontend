import { StaffAppointmentForm as AppointmentForm } from './StaffAppointmentForm';
import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, root, label, appointmentStatus, moduleNames, type Bootstrap, type Appointment } from './api';

export function StaffAppointments({ boot, onEditingChange }: { boot: Bootstrap; onEditingChange?: (editing: boolean) => void }) {
  const [items,setItems]=useState<Appointment[]>([]),[refresh,setRefresh]=useState(0),[creating,setCreating]=useState(false);
  const [editing,setEditing]=useState<Appointment|undefined>();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(() => { onEditingChange?.(Boolean(creating || editing)); }, [creating, editing, onEditingChange]);
  useEffect(()=>{const c=new AbortController();void get<Appointment[]>(`${root(boot.clubId)}/appointments`,c.signal).then(setItems).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load appointments.'));});return()=>c.abort();},[boot.clubId,refresh]);
  const end=async(a:Appointment)=>{setBusy(true);setError('');try{await post(`${root(boot.clubId)}/appointments/${a.id}/transition`,{status:'ENDED',revision:a.revision,note:'Appointment ended from the staff workspace.'});setRefresh(r=>r+1);}catch(e){setError(extractApiErrorMessage(e,'Could not end appointment.'));}finally{setBusy(false);}};
  if (creating || editing) return <AppointmentForm key={editing?.id??'new'} appointment={editing} boot={boot} onSaved={()=>{setCreating(false);setEditing(undefined);setRefresh(r=>r+1);}} onCancel={()=>{setCreating(false);setEditing(undefined);}}/>;
  return <section className="ops-editor"><div className="ops-toolbar"><h3>Staff appointments</h3>{boot.leadership&&<button onClick={()=>{setCreating(true);setEditing(undefined);}}>Invite staff member</button>}</div>
    {error&&<p role="alert" className="ops-alert">{error}</p>}
    {!items.length&&!creating&&<p className="ops-muted">Create an appointment to assign a specialist, squad and explicit access. Existing club members are listed in the Club members tab.</p>}
    <div className="ops-grid">{items.map(a=><article key={a.id} className="ops-card"><span className="ops-badge">{appointmentStatus(a)}</span><h3>{a.name} · {a.title}</h3><p className="ops-muted">{a.specialisations.map(label).join(', ')} · {label(a.engagement)}</p><p className="ops-muted">{a.starts_on} – {a.ends_on??'Ongoing'} · {a.squad_id?boot.squads.find(s=>s.id===a.squad_id)?.name:'Club-wide'}</p><details><summary>Assigned access</summary>{a.permissions.map(p=><p className="ops-muted" key={p}>{moduleNames[p.split(':')[0]]} · {p.endsWith(':WRITE')?'Read and manage':'Read'}</p>)}</details>{boot.leadership&&['INVITED','ACTIVE'].includes(a.status)&&<div className="ops-footer"><button disabled={busy} onClick={()=>{setEditing(a);setCreating(false);}}>Change appointment</button><button disabled={busy} onClick={()=>{void end(a);}}>End appointment & access</button></div>}</article>)}</div>
  </section>;
}
