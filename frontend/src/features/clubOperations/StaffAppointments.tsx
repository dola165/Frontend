import { ShieldCheck, UserPlus } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { AppointmentSummary } from './AppointmentSummary';
import { StaffAppointmentForm as AppointmentForm } from './StaffAppointmentForm';
import { useEffect, useState } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, root, type Bootstrap, type Appointment } from './api';

export function StaffAppointments({ boot, onEditingChange }: { boot: Bootstrap; onEditingChange?: (editing: boolean) => void }) {
  const [items,setItems]=useState<Appointment[]>([]),[refresh,setRefresh]=useState(0),[creating,setCreating]=useState(false);
  const [editing,setEditing]=useState<Appointment|undefined>();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(() => { onEditingChange?.(Boolean(creating || editing)); }, [creating, editing, onEditingChange]);
  useEffect(()=>{const c=new AbortController();void get<Appointment[]>(`${root(boot.clubId)}/appointments`,c.signal).then(setItems).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Could not load appointments.'));});return()=>c.abort();},[boot.clubId,refresh]);
  const end=async(a:Appointment)=>{setBusy(true);setError('');try{await post(`${root(boot.clubId)}/appointments/${a.id}/transition`,{status:'ENDED',revision:a.revision,note:'Appointment ended from the staff workspace.'});setRefresh(r=>r+1);}catch(e){setError(extractApiErrorMessage(e,'Could not end appointment.'));}finally{setBusy(false);}};
  if (creating || editing) return <AppointmentForm key={editing?.id??'new'} appointment={editing} boot={boot} onSaved={()=>{setCreating(false);setEditing(undefined);setRefresh(r=>r+1);}} onCancel={()=>{setCreating(false);setEditing(undefined);}}/>;
  return <section className="ops-editor"><div className="ops-toolbar"><h3>Staff appointments</h3>{boot.leadership&&<button className="ops-primary" onClick={()=>{setCreating(true);setEditing(undefined);}}><UserPlus size={16}/> Invite staff member</button>}</div>
    {error&&<p role="alert" className="ops-alert">{error}</p>}
    {!items.length&&!creating&&<EmptyState icon={ShieldCheck} title="Build your club’s staff team" description="Invite a specialist, choose their teams and agree the tools they can use. They review the appointment before access begins."/>}
    <div className="connections-appointments">{items.map(a=><AppointmentSummary key={a.id} appointment={a} squads={boot.squads} showPerson>{boot.leadership&&['INVITED','ACTIVE'].includes(a.status)&&<><button disabled={busy} onClick={()=>{setEditing(a);setCreating(false);}}>Change appointment</button><button className="appointment-summary__quiet appointment-summary__danger" disabled={busy} onClick={()=>{void end(a);}}>End appointment & access</button></>}</AppointmentSummary>)}</div>
  </section>;
}
