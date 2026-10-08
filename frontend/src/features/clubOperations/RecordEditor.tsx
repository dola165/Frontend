import { FacilityFields } from './FacilityFields';
import { editorDescription, fieldGroups, fieldHelp, fieldLabel, reviewValue } from './editorPresentation';
import { FacilityCard } from '../../components/club/tabs/TabFacilities';
import { WorkspaceEditor, EditorSection, EditorChecklist } from '../../components/workspace/editor/WorkspaceEditor';
import { useClubEditorClose } from './useClubEditorClose';
import { useRef, useState, type FormEvent } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { label, post, put, root, type Bootstrap, type Definition, type Field, type OperationRecord } from './api';

const subjects = new Set(['STAFF_AVAILABILITY','CREDENTIAL','CONSENT','COLLECTION','EMERGENCY_CONTACT','ATTENDANCE','MEDICAL_APPOINTMENT','CLINICAL_NOTE','RESTRICTION','GOAL','OBSERVATION','REVIEW','EDUCATION_ABSENCE','EDUCATION_CONTACT','REGISTRATION','INSTALMENT','FINANCIAL_SUPPORT','PASSENGER','DEPARTURE','EQUIPMENT_ISSUE']);
const relatedKinds: Record<string,string> = { EQUIPMENT_ISSUE:'ASSET', MAINTENANCE:'ASSET', PASSENGER:'TRIP', EMERGENCY_PLAN:'FACILITY', MATCH_PREPARATION:'EMERGENCY_PLAN' };
const numberOrNull = (v: string) => v ? Number(v) : null;
const localTime = (value: string) => { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };

export function RecordEditor({ boot, definition, record, onSaved, onCancel }: { boot: Bootstrap; definition: Definition; record?: OperationRecord; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(record?.title ?? '');
  const [squad, setSquad] = useState(record?.squad_id?.toString() ?? boot.defaultSquadId?.toString() ?? '');
  const [subject, setSubject] = useState(record?.subject_user_id?.toString() ?? boot.defaultSubjectId?.toString() ?? '');
  const [assignee, setAssignee] = useState(record?.assigned_user_id?.toString() ?? '');
  const [event, setEvent] = useState(record?.event_id?.toString() ?? '');
  const [session, setSession] = useState(record?.session_id?.toString() ?? (['ATTENDANCE','CONSENT','DUTY'].includes(definition.kind)?boot.defaultSessionId?.toString():undefined) ?? '');
  const [related, setRelated] = useState(record?.related_record_id?.toString() ?? '');
  const [due, setDue] = useState(record?.due_on?.slice(0,10) ?? '');
  const [data, setData] = useState<Record<string,string>>(record?.data ?? (boot.settings.currency && definition.fields.some(f => f.key === 'currency') ? { currency: boot.settings.currency } : {}));
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const facility = definition.kind === 'FACILITY';
  const draft = JSON.stringify({ title, squad, subject, assignee, event, session, related, due, data });
  const initial = useRef(draft);
  const { requestClose, confirmation } = useClubEditorClose(draft !== initial.current, busy || uploading, onCancel);
  const permission = boot.modules.find(m => m.id === definition.module);
  const guardianDecision = ['CONSENT','COLLECTION'].includes(definition.kind);
  const playerSubject=subjects.has(definition.kind)&&!['STAFF_AVAILABILITY','CREDENTIAL'].includes(definition.kind);
  const people=boot.people.filter(p=>!playerSubject||!squad||!boot.peopleBySquad||boot.peopleBySquad.some(link=>link.id===p.id&&link.squad_id===Number(squad))||record?.subject_user_id===p.id);
  const staff = guardianDecision ? boot.guardians.filter(g => g.child_id === Number(subject)) : boot.staff;
  const change = (key: string, value: string) => setData(previous => ({ ...previous, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy || uploading) return; setBusy(true); setError('');
    try {
      if(facility && Boolean(data.latitude?.trim()) !== Boolean(data.longitude?.trim())) { setError('Enter both entrance coordinates, or remove the pin in Place & location.'); return; }
      const body = { kind: definition.kind, title, squadId: numberOrNull(squad), subjectUserId: numberOrNull(subject), assignedUserId: numberOrNull(assignee), eventId: numberOrNull(event), sessionId:numberOrNull(session), relatedRecordId: numberOrNull(related), dueOn: due || null, data, revision: record?.revision ?? null };
      if (record) await put(`${root(boot.clubId)}/records/${record.id}`, body); else await post(`${root(boot.clubId)}/records`, body);
      await onSaved();
    } catch (e) { setError(extractApiErrorMessage(e, 'Could not save this record. Your changes are still here.')); }
    finally { setBusy(false); }
  };
  const field = (f: Field) => {
    const value = data[f.key] ?? '';
    if(f.key==='placeType') return <select aria-label="Location type" required value={value} onChange={e=>change(f.key,e.target.value)}><option value="">Choose venue or facility…</option><option value="VENUE">Venue — matches or football training</option><option value="FACILITY">Facility — gym, changing rooms, medical room or clubhouse</option></select>;
    const accessible = { 'aria-label':fieldLabel(f),'aria-describedby':fieldHelp(definition.kind,f.key)?`operation-help-${f.key}`:undefined };
    const common = { ...accessible, required: f.required || f.key === 'placeType', value, onChange: (e: { target: { value: string } }) => change(f.key, e.target.value) };
    if (f.type === 'textarea' || f.type === 'urls') return <textarea {...common} maxLength={4000} rows={3} />;
    if (f.type === 'choice') return <select {...common}><option value="">Choose…</option>{f.options.map(o => <option key={o} value={o}>{label(o)}</option>)}</select>;
    if (f.type === 'currency') return <select {...common}><option value="">Choose currency…</option>{[...new Set(['GEL','EUR','GBP','USD',value])].filter(Boolean).map(code=><option key={code}>{code}</option>)}</select>;
    if (f.type === 'datetime') return <input {...accessible} type="datetime-local" required={f.required} value={localTime(value)} onChange={e => change(f.key,e.target.value ? new Date(e.target.value).toISOString() : '')} />;
    if (f.type === 'date') return <input type="date" {...common} />;
    if (f.key === 'venueId') return <select {...common}><option value="">No linked venue</option>{boot.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>;
    if (['collectionReference','permissionReference','requirementsReference'].includes(f.key)) {
      const kind = f.key === 'collectionReference' ? 'COLLECTION' : f.key === 'requirementsReference' ? 'COMPETITION_REQUIREMENTS' : 'CONSENT';
      return <select {...common}><option value="">Choose authorisation…</option>{boot.links.filter(l => l.kind === kind).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select>;
    }
    if (['integer','money','latitude','longitude'].includes(f.type)) return <input {...common} type="number" min={f.type === 'latitude' ? -90 : f.type === 'longitude' ? -180 : f.type === 'money' ? 0 : 1} max={f.type === 'latitude' ? 90 : f.type === 'longitude' ? 180 : undefined} step={f.type === 'integer' ? 1 : f.type === 'money' ? '.01' : 'any'} />;
    return <input {...common} maxLength={500} />;
  };
  const attendance = definition.kind === 'ATTENDANCE';
  const personName = boot.people.find(p => String(p.id) === subject)?.name;
  const activityName = session ? boot.sessions.find(s => String(s.id) === session)?.title : boot.events.find(e => String(e.id) === event)?.title;
  const preview = definition.kind === 'FACILITY' ? <div className="club-public"><p className="workspace-editor__hint">Public page preview · changes appear after saving and publishing.</p><FacilityCard clubId={boot.clubId} facility={{id: record?.id ?? 0, title: title || 'Location name', details: data, squadId: squad ? Number(squad) : null, squadName: boot.squads.find(s => String(s.id) === squad)?.name}} /></div> : <><section className="workspace-editor__preview"><div className="workspace-editor__preview-label">{definition.label}<span>{record ? label(record.status) : 'Not saved'}</span></div><div className="workspace-editor__preview-body"><strong>{title || `New ${definition.label.toLowerCase()}`}</strong><p>{boot.squads.find(s => String(s.id) === squad)?.name ?? 'Club-wide'}</p>{attendance && <><p>{personName || 'Choose a person'}</p><p>{activityName || 'Choose an event or training session'}</p></>}<p>{staff.find(s => String(s.id) === assignee)?.name ?? 'No responsible person assigned'}</p>{due && <p>Review / due: {due}</p>}</div></section><EditorChecklist title="Before you save" items={[{ label:'A clear title', complete:Boolean(title.trim()) },{ label:'Required details added', complete:definition.fields.filter(f => f.required).every(f => Boolean(data[f.key]?.trim())) && (!attendance || Boolean(subject)) },{ label:'Scope selected', complete:Boolean(permission?.globalWrite || squad) },...(attendance ? [{label:'Event or training session selected',complete:Boolean(event || session)}] : [])]}>{attendance && <p>Check collection authorisation before recording a player’s departure.</p>}</EditorChecklist></>;
  const review = <dl className="workspace-review-list"><div><dt>Title</dt><dd>{title || 'Not entered'}</dd></div><div><dt>Scope</dt><dd>{boot.squads.find(s=>String(s.id)===squad)?.name??'Club-wide'}</dd></div>{attendance && <><div><dt>Person</dt><dd>{personName || 'Not selected'}</dd></div><div><dt>Event or training session</dt><dd>{activityName || 'Not selected'}</dd></div></>}<div><dt>Responsible person</dt><dd>{staff.find(p=>String(p.id)===assignee)?.name??'Unassigned'}</dd></div>{due&&<div><dt>Next action or review</dt><dd>{due}</dd></div>}{definition.fields.filter(f => data[f.key]).map(f => <div key={f.key}><dt>{fieldLabel(f)}</dt><dd>{reviewValue(f,data[f.key],boot)}</dd></div>)}</dl>;
  const definitionField = (f: Field) => <label key={f.key} className={`workspace-editor__field ${['textarea','urls'].includes(f.type) ? 'ops-wide' : ''}`}><span>{fieldLabel(f)}{f.required && <span className="workspace-editor__required" aria-hidden="true">*</span>}</span>{!f.required && f.key !== 'placeType' && <span className="editor-field-help">Optional</span>}{field(f)}{fieldHelp(definition.kind,f.key) && <small id={`operation-help-${f.key}`} className="editor-field-help">{fieldHelp(definition.kind,f.key)}</small>}</label>;
  return <WorkspaceEditor title={`${record ? 'Edit' : 'New'} ${definition.label.toLowerCase()}`} eyebrow="Club workspace" description={editorDescription(definition)} formLabel={`${record ? 'Edit' : 'New'} ${definition.label.toLowerCase()}`} accent="club" saveLabel={record ? 'Save changes' : `Save ${definition.label.toLowerCase()}`} saving={busy} disabled={busy || uploading} footerNote="Your changes are saved only when you choose Save." onSubmit={e => { void submit(e); }} onRequestClose={requestClose} backLabel="Back to records" stepLabels={facility ? ['Place', 'Visitor information', 'Responsibility', 'Review & save'] : ['Details', 'Responsibility & timing', 'Review & save']} preview={preview} confirmation={confirmation} feedback={error ? <p role="alert" className="ops-alert">{error}</p> : undefined}>
    <EditorSection number="01" title={facility ? "Place & location" : definition.label} description={facility ? "Choose a playing venue or a supporting facility, then explain how the club uses it." : "Required fields are marked with an asterisk. Other details can be added when available."}><div className="ops-form-grid">
      <label className="workspace-editor__field ops-wide"><span>{facility ? "Location name" : "Title"}<span aria-hidden="true"> *</span></span><input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      {subjects.has(definition.kind) && <label>Person<select required={definition.kind !== 'EQUIPMENT_ISSUE'} disabled={Boolean(record)} value={subject} onChange={e => { setSubject(e.target.value); if (guardianDecision) setAssignee(''); }}><option value="">Choose a person…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {relatedKinds[definition.kind] && <label>Related {label(relatedKinds[definition.kind]).toLowerCase()}<select required disabled={Boolean(record)} value={related} onChange={e => setRelated(e.target.value)}><option value="">Choose…</option>{boot.links.filter(l => l.kind === relatedKinds[definition.kind]).map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>}
    </div>{facility ? <FacilityFields mode="place" boot={boot} definition={definition} data={data} change={values=>setData(previous=>({...previous,...values}))} renderField={definitionField} onUploading={setUploading}/> : fieldGroups(definition).map(group=><section className="editor-field-group" key={group.title}><header><h5>{group.title}</h5><p>{group.description}</p></header><div className="ops-form-grid">{group.fields.map(definitionField)}</div></section>)}
    </EditorSection>
    {facility && <EditorSection number="02" title="Visitor information" description="Optional photos and practical details for players, families and visiting teams."><FacilityFields mode="visitors" boot={boot} definition={definition} data={data} change={values=>setData(previous=>({...previous,...values}))} renderField={definitionField} onUploading={setUploading}/></EditorSection>}
    <EditorSection number={facility ? "03" : "02"} title={facility ? "Responsibility & scope" : "Responsibility & timing"} description={facility ? "Choose who uses this location and who keeps its information up to date." : "Choose the people involved and connect any relevant event or session."}><div className="ops-form-grid">
      <label>Squad<select required={!permission?.globalWrite} value={squad} onChange={e => { setSquad(e.target.value); if(playerSubject&&!record)setSubject(''); if(!record)setSession(''); }}><option value="">Club-wide</option>{boot.squads.filter(s => permission?.globalWrite || permission?.writeSquads.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Next action or review date (optional)<input type="date" value={due} onChange={e => setDue(e.target.value)} /><small className="editor-field-help">A reminder to follow up; this does not schedule an event.</small></label>
      <label>{guardianDecision ? 'Guardian who decides' : 'Responsible staff member'}<select required={guardianDecision || definition.kind === 'DUTY'} value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">{guardianDecision ? 'Choose confirmed guardian…' : 'Unassigned'}</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {!['FACILITY','ASSET','CREDENTIAL','EDUCATION_CONTACT','BUDGET','FINANCIAL_SUPPORT'].includes(definition.kind) && <label>Related event<select required={definition.kind === 'MATCH_PREPARATION'||definition.kind === 'ATTENDANCE'&&!session} disabled={Boolean(record)||Boolean(session)} value={event} onChange={e => setEvent(e.target.value)}><option value="">No event</option>{boot.events.map(e => <option key={e.id} value={e.id}>{e.title} · {e.starts_at.slice(0,10)}</option>)}</select></label>}
      {['ATTENDANCE','CONSENT','DUTY'].includes(definition.kind)&&<label>Training session<select disabled={Boolean(record)||Boolean(event)} value={session} onChange={e=>setSession(e.target.value)}><option value="">No training session</option>{boot.sessions.filter(s=>!squad||!s.squad_id||s.squad_id===Number(squad)).map(s=><option key={s.id} value={s.id}>{s.title} · {s.squad_name} · {s.starts_at.slice(0,10)}</option>)}</select></label>}
    </div>{guardianDecision && <p className="workspace-editor__hint">Only the confirmed guardian can give or withdraw this permission.</p>}{definition.fields.some(f => f.type === 'datetime') && <p className="workspace-editor__hint">Times use your local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>}</EditorSection>
    <EditorSection number={facility ? "04" : "03"} title="Review & save" description="Check the details before adding this to the club’s records.">{review}<p className="workspace-editor__hint">{facility ? "New venues and facilities are saved as drafts. Publish from the saved record when the information is ready." : "After saving, you can attach supporting documents and use the actions available on the record."}</p>{definition.module === 'FINANCE' && <p className="workspace-editor__hint">Saving or approving this record does not transfer money.</p>}</EditorSection>
  </WorkspaceEditor>;
}
