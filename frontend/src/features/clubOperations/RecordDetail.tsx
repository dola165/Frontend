import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Map, Pencil } from 'lucide-react';
import { Badge, Button, ButtonLink, Field, PageHeader, Panel } from '../../design/primitives';
import { MediaImage } from '../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../../utils/apiError';
import { fieldLabel, reviewValue } from './editorPresentation';
import { get, post, root, label, transitionLabel, type OperationRecord, type Definition, type History, type Bootstrap } from './api';
import { RecordDocuments } from './RecordDocuments';
import { statusTone, transitionStyle } from './records/recordStatus';
import { Dialog } from '../../design/Dialog';
import './records/records.css';
import { appLanguage, formatDate } from '../../utils/formatting';
import { assertCurrentAuthSession, getAuthSessionId } from '../../utils/authStorage';

/** One record: its facts, the actions its current status allows, supporting documents and history. */
type DetailProps = { club: number; boot: Bootstrap; record: OperationRecord; definition: Definition; backLabel: string; onEdit: () => void; onChanged: (record?: Pick<OperationRecord, 'id' | 'title'>) => Promise<void>; onClose: () => void };
export function RecordDetail(props: DetailProps) {
  return <RecordDetailSession key={`${props.club}:${props.boot.actorId}:${props.record.id}:${getAuthSessionId()}`} {...props} />;
}
function RecordDetailSession({ club, boot, record, definition, backLabel, onEdit, onChanged, onClose }: DetailProps) {
  const [history, setHistory] = useState<History[]>([]), [note, setNote] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirming, setConfirming] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ revision: number; status: string | null } | null>(null);
  const [authSessionId] = useState(getAuthSessionId);
  const busyRef = useRef(false), savedRevision = useRef<number | null>(null), active = useRef(true);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const confirmed = saved !== null && saved.revision === record.revision;
  const ka = appLanguage() === 'ka';
  const receipt = { id: record.id, title: record.title };
  const style = transitionStyle(record.transitions);
  useEffect(() => {
    const controller = new AbortController();
    void get<History[]>(`${root(club)}/records/${record.id}/history`, controller.signal).then(rows => { if (!controller.signal.aborted) setHistory(rows); }).catch(() => { if (!controller.signal.aborted) setError('Could not load the record history.'); });
    return () => controller.abort();
  }, [club, record.id, record.revision]);
  const refreshSaved = async () => {
    if (busyRef.current || !active.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await onChanged(receipt); }
    catch { if (active.current) setError(ka ? 'ცვლილება შენახულია. მიმდინარე ხედი ვერ განახლდა.' : 'Change saved. The current view could not refresh.'); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
  };
  const transition = async (status: string) => {
    if (!active.current || busyRef.current || savedRevision.current === record.revision) return;
    busyRef.current = true; setBusy(true); setError('');
    let persisted = false;
    try {
      assertCurrentAuthSession(authSessionId);
      const result = await post<OperationRecord | undefined>(`${root(club)}/records/${record.id}/transition`, { status, revision: record.revision, note: note || null }, undefined, authSessionId);
      persisted = true; savedRevision.current = record.revision;
      if (active.current) { setSaved({ revision: record.revision, status: result?.status ?? null }); setConfirming(null); }
    } catch (e) { if (active.current) setError(extractApiErrorMessage(e, ka ? 'ცვლილების დადასტურება ვერ მოხერხდა. გამეორებამდე შეამოწმეთ ჩანაწერი.' : 'Could not confirm this change. Review the record before trying again.')); }
    finally { busyRef.current = false; if (active.current) setBusy(false); }
    if (persisted && active.current) await refreshSaved();
  };
  const facts: Array<[string, ReactNode, boolean?]> = [
    ...(record.subject_user_id ? [['Person', boot.people.find(p => p.id === record.subject_user_id)?.name ?? 'Former club member'] as [string, string]] : []),
    ['Scope', boot.squads.find(s => s.id === record.squad_id)?.name ?? 'Club-wide'],
    ...(record.assigned_user_id ? [['Responsible person', [...boot.staff, ...boot.guardians].find(p => p.id === record.assigned_user_id)?.name ?? 'Former appointee'] as [string, string]] : []),
    ...(record.event_id ? [['Event', boot.events.find(e => e.id === record.event_id)?.title ?? 'Past or unavailable event'] as [string, string]] : []),
    ...(record.session_id ? [['Training session', boot.sessions.find(e => e.id === record.session_id)?.title ?? 'Past or unavailable session'] as [string, string]] : []),
    ...(record.related_record_id ? [['Linked record', boot.links.find(l => l.id === record.related_record_id)?.title ?? 'Archived record'] as [string, string]] : []),
    ...(record.due_on ? [['Next action or review', formatDate(record.due_on.slice(0, 10))] as [string, string]] : []),
    ...definition.fields.filter(f => record.data[f.key]).map(f => [fieldLabel(f), f.type === 'urls'
      ? <div className="rec-photos">{record.data[f.key].split(/\r?\n/).filter(Boolean).map(url => <MediaImage key={url} src={resolveMediaUrl(url)} alt="Facility photo" />)}</div>
      : reviewValue(f, record.data[f.key], boot), ['textarea', 'urls'].includes(f.type)] as [string, ReactNode, boolean]),
  ];
  return <div className="rec-page">
    <div className="rec-back"><Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
    <PageHeader title={record.title} subtitle={<span className="rec-subtitle">{definition.label}<Badge tone={statusTone(record)}>{record.expired ? 'Expired · ' : ''}{confirmed ? saved.status ? label(saved.status) : ka ? 'ცვლილება შენახულია' : 'Change saved' : label(record.status)}</Badge></span>}
      actions={record.map_plan_id ? <ButtonLink to={`/world/map?plans=staff&plan=${record.map_plan_id}`}><Map aria-hidden="true" />Open journey plan</ButtonLink>
        : record.canEdit && <Button disabled={busy || confirmed} onClick={onEdit}><Pencil aria-hidden="true" />Edit details</Button>} />
    {confirmed && <div className="gk-notice cw-notices__success" role="status"><span className="cw-notices__text">{ka ? `ცვლილება შენახულია: ${record.title} · #${record.id}` : `Change saved: ${record.title} · #${record.id}`}</span>
      <Button size="sm" disabled={busy} onClick={() => void refreshSaved()}>{ka ? 'შენახული ჩანაწერის განახლება' : 'Refresh saved record'}</Button></div>}
    <div className="gk-grid gk-grid--split">
      <div className="gk-stack">
        {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
        <Panel flush title="Details"><dl className="rec-facts">{facts.map(([name, value, wide]) => <div key={name} className={wide ? 'rec-wide' : undefined}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></Panel>
        <Panel flush><RecordDocuments club={club} record={record.id} canUpload={record.canEdit && !busy && !confirmed} /></Panel>
      </div>
      <div className="gk-stack">
        {record.transitions.length > 0 && <Panel padded title="Next step">
          <div className="gk-stack gk-stack--tight">
            <Field label={<>Decision or action note <span className="rec-optional">(optional)</span></>} htmlFor="rec-transition-note"><textarea id="rec-transition-note" className="gk-input" disabled={busy || confirmed} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} /></Field>
            <div className="rec-transitions">{record.transitions.map(state => <Button key={state} variant={style(state).variant} disabled={busy || confirmed}
              onClick={() => { if (style(state).confirm) setConfirming(state); else void transition(state); }}>{transitionLabel(record.kind, state)}</Button>)}</div>
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
    <Dialog open={confirming !== null} role="alertdialog" size="sm" onClose={() => setConfirming(null)}
      title={confirming ? `${transitionLabel(record.kind, confirming)}?` : ''} description={`“${record.title}” changes to “${confirming ? label(confirming) : ''}”${note.trim() ? ', with your note' : ''}. The change is kept in the record history.`}
      footer={<><Button variant="ghost" onClick={() => setConfirming(null)}>Keep as it is</Button>
        <Button variant="danger" disabled={busy || confirmed} onClick={() => { const state = confirming!; setConfirming(null); void transition(state); }}>{confirming ? transitionLabel(record.kind, confirming) : ''}</Button></>} />
  </div>;
}
