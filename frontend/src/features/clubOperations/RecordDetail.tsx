import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Map, Pencil } from 'lucide-react';
import { Badge, Button, ButtonLink, Field, PageHeader, Panel } from '../../design/primitives';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { fieldLabel, reviewValue } from './editorPresentation';
import { get, post, root, label, transitionLabel, type OperationRecord, type Definition, type History, type Bootstrap } from './api';
import { RecordDocuments } from './RecordDocuments';
import { statusTone } from './records/recordStatus';
import './records/records.css';

/** One record: its facts, the actions its current status allows, supporting documents and history. */
export function RecordDetail({ club, boot, record, definition, backLabel, onEdit, onChanged, onClose }: { club: number; boot: Bootstrap; record: OperationRecord; definition: Definition; backLabel: string; onEdit: () => void; onChanged: () => Promise<void>; onClose: () => void }) {
  const [history, setHistory] = useState<History[]>([]), [note, setNote] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void get<History[]>(`${root(club)}/records/${record.id}/history`, controller.signal).then(setHistory).catch(() => { if (!controller.signal.aborted) setError('Could not load the record history.'); });
    return () => controller.abort();
  }, [club, record.id, record.revision]);
  const transition = async (status: string) => {
    if (busy) return; setBusy(true); setError('');
    try { await post(`${root(club)}/records/${record.id}/transition`, { status, revision: record.revision, note: note || null }); await onChanged(); }
    catch (e) { setError(extractApiErrorMessage(e, 'Could not update this record.')); }
    finally { setBusy(false); }
  };
  const facts: Array<[string, ReactNode, boolean?]> = [
    ...(record.subject_user_id ? [['Person', boot.people.find(p => p.id === record.subject_user_id)?.name ?? 'Former club member'] as [string, string]] : []),
    ['Scope', boot.squads.find(s => s.id === record.squad_id)?.name ?? 'Club-wide'],
    ...(record.assigned_user_id ? [['Responsible person', [...boot.staff, ...boot.guardians].find(p => p.id === record.assigned_user_id)?.name ?? 'Former appointee'] as [string, string]] : []),
    ...(record.event_id ? [['Event', boot.events.find(e => e.id === record.event_id)?.title ?? 'Past or unavailable event'] as [string, string]] : []),
    ...(record.session_id ? [['Training session', boot.sessions.find(e => e.id === record.session_id)?.title ?? 'Past or unavailable session'] as [string, string]] : []),
    ...(record.related_record_id ? [['Linked record', boot.links.find(l => l.id === record.related_record_id)?.title ?? 'Archived record'] as [string, string]] : []),
    ...(record.due_on ? [['Next action or review', record.due_on.slice(0, 10)] as [string, string]] : []),
    ...definition.fields.filter(f => record.data[f.key]).map(f => [fieldLabel(f), f.type === 'urls'
      ? <div className="rec-photos">{record.data[f.key].split(/\r?\n/).filter(Boolean).map(url => <MediaImage key={url} src={resolveMediaUrl(url)} alt="Facility photo" />)}</div>
      : reviewValue(f, record.data[f.key], boot), ['textarea', 'urls'].includes(f.type)] as [string, ReactNode, boolean]),
  ];
  return <div className="rec-page">
    <div className="rec-back"><Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
    <PageHeader title={record.title} subtitle={<span className="rec-subtitle">{definition.label}<Badge tone={statusTone(record)}>{record.expired ? 'Expired · ' : ''}{label(record.status)}</Badge></span>}
      actions={record.map_plan_id ? <ButtonLink to={`/world/map?plans=staff&plan=${record.map_plan_id}`}><Map aria-hidden="true" />Open journey plan</ButtonLink>
        : record.canEdit && <Button onClick={onEdit}><Pencil aria-hidden="true" />Edit details</Button>} />
    <div className="gk-grid gk-grid--split">
      <div className="gk-stack">
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        <Panel flush title="Details"><dl className="rec-facts">{facts.map(([name, value, wide]) => <div key={name} className={wide ? 'rec-wide' : undefined}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></Panel>
        <Panel flush><RecordDocuments club={club} record={record.id} canUpload={record.canEdit} /></Panel>
      </div>
      <div className="gk-stack">
        {record.transitions.length > 0 && <Panel padded title="Next step">
          <div className="gk-stack gk-stack--tight">
            <Field label={<>Decision or action note <span className="rec-optional">(optional)</span></>} htmlFor="rec-transition-note"><textarea id="rec-transition-note" className="gk-input" value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></Field>
            <div className="rec-transitions">{record.transitions.map((state, index) => <Button key={state} variant={index === 0 ? 'primary' : 'secondary'} disabled={busy} onClick={() => { void transition(state); }}>{transitionLabel(record.kind, state)}</Button>)}</div>
          </div>
        </Panel>}
        <Panel flush><details className="rec-disclosure"><summary>Record history <span className="gk-faint gk-num">{history.length}</span></summary>
          <div className="rec-disclosure__body">{history.length ? history.map(h => <div className="rec-history" key={h.id}>
            <strong>{label(h.action)}{h.to_status ? ` · ${label(h.to_status)}` : ''}</strong>
            <time dateTime={h.created_at}>{h.actor} · {new Date(h.created_at).toLocaleString()}</time>{h.note && <p>{h.note}</p>}
          </div>) : <p className="gk-muted">No changes recorded yet.</p>}</div>
        </details></Panel>
      </div>
    </div>
  </div>;
}
