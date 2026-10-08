import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, UserRound, Check, ShieldCheck } from 'lucide-react';
import { WorkspaceEditor, EditorSection } from '../../components/workspace/editor/WorkspaceEditor';
import { useClubEditorClose } from './useClubEditorClose';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, put, root, label, appointmentScope, appointmentSquads, moduleNames, dateOnly, clubToday, type Bootstrap, type Appointment, type Choice } from './api';
import { StaffScopePicker, type StaffScopeSelection } from './StaffScopePicker';
import { scopePayload } from './api';
import type { StaffRole } from './useWorkspaceRoles';
import './staff-team.css';

const specialisationFor = (key: string) => key === 'TRAVEL_COORDINATOR' ? 'TEAM_MANAGER' : key === 'FACILITIES_COORDINATOR' ? 'OTHER' : key;

export function StaffAppointmentForm({ boot, appointment, initialPerson, roles = [], onSaved, onCancel }: {
  boot: Bootstrap; appointment?: Appointment; initialPerson?: Choice; roles?: StaffRole[]; onSaved: () => void; onCancel: () => void;
}) {
  const [person, setPerson] = useState<Choice | null>(appointment ? {id:appointment.user_id,name:appointment.name ?? 'Staff member'} : initialPerson ?? null);
  const [query,setQuery]=useState(''), [matches,setMatches]=useState<Choice[]>([]), [searching,setSearching]=useState(false), [searchError,setSearchError]=useState('');
  const [title,setTitle]=useState(appointment?.title ?? ''), [specialisations,setSpecialisations]=useState(appointment?.specialisations ?? []);
  const [permissions,setPermissions]=useState<Record<string,string>>(Object.fromEntries(appointment?.permissions.map(p=>p.split(':')) ?? []));
  const [engagement,setEngagement]=useState(appointment?.engagement ?? 'VOLUNTEER'), [scope,setScope]=useState<StaffScopeSelection>(appointment?{clubWide:appointment.squad_id==null,squadIds:appointmentSquads(appointment)}:{clubWide:false,squadIds:[]});
  const [starts,setStarts]=useState(appointment ? dateOnly(appointment.starts_on) : clubToday(boot.settings.timezone || undefined)), [ends,setEnds]=useState(dateOnly(appointment?.ends_on));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''); const saving=useRef(false);
  const [preset,setPreset]=useState('');
  const availableRoles: StaffRole[]=roles.length ? roles : boot.specialisations.map(key=>({key,title:label(key),description:'Choose the workspace access this person needs.',permissions:key==='REFEREE'?['FACILITIES:READ']:[]}));
  useEffect(()=>{
    const c=new AbortController();setSearchError('');setMatches([]);
    if(person || query.trim().length<2){setSearching(false);return ()=>c.abort();}
    setSearching(true);
    const timer=setTimeout(()=>{void get<Choice[]>(`${root(boot.clubId)}/staff-candidates?q=${encodeURIComponent(query.trim())}`,c.signal).then(rows=>{if(!c.signal.aborted)setMatches(rows);}).catch(e=>{if(!c.signal.aborted)setSearchError(extractApiErrorMessage(e,'Could not find accounts.'));}).finally(()=>{if(!c.signal.aborted)setSearching(false);});},250);
    return()=>{clearTimeout(timer);c.abort();};
  },[query,person,boot.clubId]);
  const draft=JSON.stringify({person,title,specialisations,permissions,engagement,scope,starts,ends}), initial=useRef(draft);
  const {requestClose,confirmation}=useClubEditorClose(draft!==initial.current,busy,onCancel);
  const assigned=Object.entries(permissions).filter(([,v])=>v);
  function chooseRole(key:string){
    setPreset(key);const role=availableRoles.find(r=>r.key===key);if(!role)return;
    setTitle(role.title);setSpecialisations([specialisationFor(key)]);setPermissions(Object.fromEntries(role.permissions.map(p=>p.split(':'))));
  }
  async function submit(e:FormEvent){
    e.preventDefault();if(saving.current)return;
    if(!person || !specialisations.length){setError('Choose a person and at least one football responsibility in Person & role.');return;}
    if(!scope.clubWide&&!scope.squadIds.length){setError('Select at least one team or choose whole-club responsibility.');return;}
    saving.current=true;setBusy(true);setError('');
    try{
      const payload={userId:person.id,title,specialisations,engagement,...scopePayload(scope),permissions:assigned.map(([m,v])=>`${m}:${v}`),startsOn:starts,endsOn:ends||null,revision:appointment?.revision};
      if(appointment)await put(`${root(boot.clubId)}/appointments/${appointment.id}`,payload);else await post(`${root(boot.clubId)}/appointments`,payload);
      onSaved();
    }catch(e){setError(extractApiErrorMessage(e,'Could not send this invitation.'));}finally{saving.current=false;setBusy(false);}
  }
  const scopeText=appointmentScope({squad_id:scope.squadIds[0]??null,squad_ids:scope.clubWide?[]:scope.squadIds},boot.squads);
  const preview=<section className="staff-invitation-preview"><ShieldCheck size={22}/><p className="ops-kicker">Invitation preview</p><h3>{person?.name ?? 'Your next team member'}</h3><strong>{title || 'Choose their role'}</strong><p>{scope.clubWide||scope.squadIds.length?scopeText:'No teams selected'}</p><p>{starts} → {ends || 'Ongoing'}</p><small>Dates use {boot.settings.timezone || 'Asia/Tbilisi'}.</small><hr/><p>{assigned.length ? `${assigned.length} workspace ${assigned.length===1?'area':'areas'}` : 'No club workspace access'}</p><small>{specialisations.includes('REFEREE') ? 'Match invitations arrive in their referee workspace. Each fixture needs their acceptance.' : 'They review the role, every selected team and the access before accepting within 14 days.'}</small></section>;
  return <WorkspaceEditor title={appointment?'Change appointment':'Invite a staff member'} eyebrow="People / Staff" description={appointment?'Update this person’s responsibilities and send the changes for acceptance.':'Choose their football role, teams and the tools they need.'} formLabel="Staff appointment" accent="club" stepLabels={['Person & role','Workspace access','Review invitation']} saveLabel={appointment?'Send revised invitation':'Send invitation'} saving={busy} footerNote={appointment?'Revised terms replace the current appointment. Access pauses until accepted.':'Access begins when the person accepts and the start date is reached.'} onRequestClose={requestClose} backLabel="Back to staff" onSubmit={submit} preview={preview} confirmation={confirmation} feedback={error?<p role="alert" className="ops-alert">{error}</p>:undefined}>
    <EditorSection number="01" title="Person & role" description="An account can have several football responsibilities without becoming a club administrator.">
      {person?<div className="staff-person-selected"><UserRound size={22}/><div><strong>{person.name}</strong><small>{appointment?'Person on this appointment':'Account selected'}</small></div>{!appointment&&<button type="button" onClick={()=>{setPerson(null);setQuery('');}}>Change person</button>}</div>:<div className="staff-account-search"><label>Find an account<span><Search size={17}/><input autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or username" maxLength={100}/></span></label><div aria-live="polite">{searchError?<p role="alert">{searchError}</p>:searching?<p>Finding accounts…</p>:query.trim().length<2?<p>Enter at least two characters. Choose an existing adult account.</p>:!matches.length?<p>No eligible accounts found. Check the name or username; the person needs a verified adult account.</p>:<ul aria-label="Matching accounts">{matches.map(m=><li key={m.id}><button type="button" onClick={()=>setPerson(m)}><UserRound size={18}/><span>{m.name}<small>Account #{m.id}</small></span><Check size={16}/></button></li>)}</ul>}</div></div>}
      <div className="ops-form-grid"><label>Role template<select value={preset} onChange={e=>chooseRole(e.target.value)}><option value="">Choose a role…</option>{[...new Set(availableRoles.map(r=>r.family ?? 'Staff responsibilities'))].map(family=><optgroup key={family} label={family}>{availableRoles.filter(r=>(r.family ?? 'Staff responsibilities')===family).map(r=><option key={r.key} value={r.key}>{r.title}</option>)}</optgroup>)}</select></label><label>Appointment title<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="For example, U12 goalkeeper coach"/></label><StaffScopePicker squads={boot.squads} value={scope} onChange={setScope}/><label>Engagement<select value={engagement} onChange={e=>setEngagement(e.target.value)}>{['VOLUNTEER','EMPLOYEE','CONTRACTOR','SHARED_STAFF'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label><label>Starts<input required type="date" value={starts} onChange={e=>setStarts(e.target.value)}/></label><label>Ends (optional)<input type="date" min={starts} value={ends} onChange={e=>setEnds(e.target.value)}/></label></div>
      <details className="staff-specialisations" open={specialisations.length===0 || undefined}><summary>Football responsibilities{specialisations.length?` · ${specialisations.map(label).join(', ')}`:''}</summary><div className="ops-module-settings">{boot.specialisations.map(s=><label className="ops-check" key={s}><input type="checkbox" checked={specialisations.includes(s)} onChange={e=>setSpecialisations(v=>e.target.checked?[...v,s]:v.filter(x=>x!==s))}/>{label(s)}</label>)}</div></details>
    </EditorSection>
    <EditorSection number="02" title="Workspace access" description="Review the suggested tools. A role title alone never grants access.">
      {availableRoles.find(r=>r.key===preset)?.description&&<p className="staff-access-note">{availableRoles.find(r=>r.key===preset)?.description}</p>}
      {!assigned.length&&<p className="staff-access-note">No club workspace access. A referee can still receive match invitations in their own workspace.</p>}
      {assigned.map(([module,access])=><div className="staff-permission" key={module}><label>{moduleNames[module]}<select value={access} onChange={e=>setPermissions(p=>({...p,[module]:e.target.value}))}><option value="READ">View only</option><option value="WRITE">View and manage</option></select></label><button type="button" aria-label={`Remove ${moduleNames[module]} access`} onClick={()=>setPermissions(p=>({...p,[module]:''}))}>Remove</button></div>)}
      <label>Add another workspace area<select value="" onChange={e=>{if(e.target.value)setPermissions(p=>({...p,[e.target.value]:'READ'}));}}><option value="">Choose an area…</option>{Object.entries(moduleNames).filter(([m])=>!permissions[m]).map(([m,name])=><option key={m} value={m}>{name}</option>)}</select></label>
      {assigned.some(([m])=>['MEDICAL','WELFARE'].includes(m))&&<p className="staff-access-note" data-tone="amber">This invitation includes confidential {assigned.filter(([m])=>['MEDICAL','WELFARE'].includes(m)).map(([m])=>moduleNames[m].toLowerCase()).join(' and ')} records. Check that this is part of the person’s responsibilities.</p>}
    </EditorSection>
    <EditorSection number="03" title="Review invitation" description="The recipient sees these terms before accepting. Nothing is granted silently."><dl className="workspace-review-list"><div><dt>Person</dt><dd>{person?.name || 'Not selected'}</dd></div><div><dt>Appointment</dt><dd>{title || 'Not entered'}</dd></div><div><dt>Football responsibilities</dt><dd>{specialisations.map(label).join(', ') || 'None selected'}</dd></div><div><dt>Teams</dt><dd>{scope.clubWide||scope.squadIds.length?scopeText:'No teams selected'}</dd></div><div><dt>Dates</dt><dd>{starts} → {ends || 'Ongoing'}</dd></div>{assigned.map(([m,v])=><div key={m}><dt>{moduleNames[m]}</dt><dd>{v==='WRITE'?'View and manage':'View only'}</dd></div>)}</dl>{appointment?.status==='ACTIVE'&&<p className="staff-access-note" data-tone="amber">Sending this revision pauses the existing appointment’s access until the person accepts again.</p>}</EditorSection>
  </WorkspaceEditor>;
}
