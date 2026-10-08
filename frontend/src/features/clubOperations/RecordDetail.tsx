import { fieldLabel, reviewValue } from './editorPresentation';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractApiErrorMessage } from '../../utils/apiError';
import { get, post, root, label, transitionLabel, type OperationRecord, type Definition, type History, type Bootstrap } from './api';
import { RecordDocuments } from './RecordDocuments';

export function RecordDetail({ club, boot, record, definition, onEdit, onChanged, onClose }: { club: number; boot: Bootstrap; record: OperationRecord; definition: Definition; onEdit: () => void; onChanged: () => Promise<void>; onClose: () => void }) {
  const [history, setHistory] = useState<History[]>([]), [note, setNote] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); void get<History[]>(`${root(club)}/records/${record.id}/history`,controller.signal).then(setHistory).catch(() => { if (!controller.signal.aborted) setError('Could not load the record history.'); }); return () => controller.abort(); },[club,record.id,record.revision]);
  const transition = async (status: string) => {
    if (busy) return; setBusy(true);setError('');
    try { await post(`${root(club)}/records/${record.id}/transition`,{ status,revision:record.revision,note:note||null }); await onChanged(); }
    catch (e) { setError(extractApiErrorMessage(e,'Could not update this record.')); }
    finally { setBusy(false); }
  };
  return <section className="ops-card ops-detail" aria-label={record.title}>
    <div className="ops-toolbar"><div><p className="ops-kicker">{definition.label}</p><h3>{record.title}</h3><span className="ops-badge">{label(record.status)}</span></div><div className="ops-row">{record.map_plan_id ? <Link to={`/map?plans=staff&plan=${record.map_plan_id}`}>Open journey plan</Link> : record.canEdit && <button onClick={onEdit}>Edit details</button>}<button onClick={onClose}>Close record</button></div></div>
    {error && <p className="ops-alert" role="alert">{error}</p>}
    <dl className="ops-form-grid">
      {record.subject_user_id&&<div><dt>Person</dt><dd>{boot.people.find(p=>p.id===record.subject_user_id)?.name??'Former club member'}</dd></div>}
      <div><dt>Scope</dt><dd>{boot.squads.find(s=>s.id===record.squad_id)?.name??'Club-wide'}</dd></div>
      {record.assigned_user_id&&<div><dt>Responsible person</dt><dd>{[...boot.staff,...boot.guardians].find(p=>p.id===record.assigned_user_id)?.name??'Former appointee'}</dd></div>}
      {record.event_id&&<div><dt>Event</dt><dd>{boot.events.find(e=>e.id===record.event_id)?.title??'Past or unavailable event'}</dd></div>}
      {record.session_id&&<div><dt>Training session</dt><dd>{boot.sessions.find(e=>e.id===record.session_id)?.title??'Past or unavailable session'}</dd></div>}
      {record.related_record_id&&<div><dt>Linked record</dt><dd>{boot.links.find(l=>l.id===record.related_record_id)?.title??'Archived record'}</dd></div>}
      {definition.fields.filter(f=>record.data[f.key]).map(f=><div key={f.key} className={f.type==='urls'?'ops-wide':undefined}><dt>{fieldLabel(f)}</dt><dd>{f.type==='urls'?<div className="editor-images-grid">{record.data[f.key].split(/\r?\n/).filter(Boolean).map(url=><MediaImage key={url} src={resolveMediaUrl(url)} alt="Facility photo" style={{width:'100%',height:140,objectFit:'cover',borderRadius:8}}/>)}</div>:reviewValue(f,record.data[f.key],boot)}</dd></div>)}
    </dl>
    {record.transitions.length>0 && <div className="ops-editor"><label>Decision or action note<textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} /></label><div className="ops-footer">{record.transitions.map(state=><button key={state} disabled={busy} onClick={()=>{void transition(state);}}>{transitionLabel(record.kind,state)}</button>)}</div></div>}
    <RecordDocuments club={club} record={record.id} canUpload={record.canEdit}/>
    <details className="workspace-record-history"><summary>Record history ({history.length})</summary>{history.map(h=><div className="ops-history" key={h.id}><strong>{label(h.action)}{h.to_status?` · ${label(h.to_status)}`:''}</strong><p className="ops-muted">{h.actor} · {new Date(h.created_at).toLocaleString()}</p>{h.note&&<p>{h.note}</p>}</div>)}</details>
  </section>;
}
