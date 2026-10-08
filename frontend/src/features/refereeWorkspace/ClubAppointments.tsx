import { AppointmentSummary } from '../clubOperations/AppointmentSummary';
import { Building2 } from 'lucide-react';
import { useRefereeHistory } from '../matchExchange/useRefereeHistory';
import { useAction } from '../matchExchange/hooks';
import { post } from '../matchExchange/api';
import { dateOnly, type Appointment } from '../clubOperations/api';

/** Joining a club and accepting a match are separate decisions, reviewed in the same workspace. */
export function ClubAppointments(){
  const {data,error,reload}=useRefereeHistory<{appointments:Appointment[]}>('/club-operations/mine');
  const {run,busy,feedback}=useAction(reload);
  if(error)return <p role="alert">Could not load club appointments. <button onClick={reload}>Retry</button></p>;
  const items=data?.appointments.filter(a=>!a.ends_on || dateOnly(a.ends_on)>=new Date().toISOString().slice(0,10))??[];
  if(!items.length)return <>{feedback}</>;
  const pending=items.filter(a=>a.status==='INVITED');
  return <>{feedback}<details className="rw-club-appointments" open={pending.length>0 || undefined}><summary><Building2 size={18}/>Your club appointments{pending.length>0&&<span>{pending.length} to review</span>}</summary><p>Club responsibilities are separate from match appointments. Accepting a club role never confirms a fixture.</p>{items.map(a=><AppointmentSummary key={a.id} appointment={a}>{a.status==='INVITED'&&<><button className="appointment-summary__primary" disabled={busy} onClick={()=>void run(()=>post(`/clubs/${a.club_id}/operations/appointments/${a.id}/transition`,{status:'ACTIVE',revision:a.revision}),'Club appointment accepted')}>Accept club appointment</button><button className="appointment-summary__quiet" disabled={busy} onClick={()=>void run(()=>post(`/clubs/${a.club_id}/operations/appointments/${a.id}/transition`,{status:'DECLINED',revision:a.revision}),'Club appointment declined')}>Decline club appointment</button></>}</AppointmentSummary>)}</details></>;
}
