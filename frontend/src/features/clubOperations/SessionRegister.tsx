import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { Avatar, Badge, Button, EmptyNote, Field, List, Panel, SearchInput, Skeleton } from '../../design/primitives';
import { get, post, root, label, type Bootstrap, type OperationRecord } from './api';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useClubEditorClose } from './useClubEditorClose';
import { TrainingVisitorsRegister } from './TrainingVisitorsRegister';
import './records/records.css';
import '../clubWorkspace/club-workspace.css';

const tone = (status: string) => status === 'ARRIVED' || status === 'COLLECTED' ? 'accent' as const : status === 'ABSENT' ? 'danger' as const : 'neutral' as const;

/** The register for one training session: everyone on the squad, two taps to mark them, corrections with a reason. */
export function SessionRegister({ boot, session, squad, onRecord }: { boot: Bootstrap; session: number; squad: number; onRecord: (r: OperationRecord) => void }) {
  const [records, setRecords] = useState<OperationRecord[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState<number | null>(null), [revision, setRevision] = useState(0), [query, setQuery] = useState('');
  const lock = useRef(false);
  const [historicalVisitors, setHistoricalVisitors] = useState<number[]>([]);
  const recordHistoricalPlayers = useCallback((ids: number[]) => setHistoricalVisitors(ids), []);
  const [correction, setCorrection] = useState<OperationRecord | null>(null), [reason, setReason] = useState('');
  const { confirmation } = useClubEditorClose(Boolean(reason.trim()), busy !== null, () => { setCorrection(null); setReason(''); });
  const info = boot.sessions.find(s => s.id === session), permission = boot.modules.find(m => m.id === 'ATTENDANCE');
  const writable = boot.settings.enabled_modules.includes('ATTENDANCE') && Boolean(permission?.globalWrite || permission?.writeSquads.includes(squad));
  const development = boot.modules.find(m => m.id === 'DEVELOPMENT');
  const canSeeVisitors = writable && Boolean(development?.globalWrite || development?.writeSquads.includes(squad));
  const members = boot.people.filter(p => boot.peopleBySquad?.some(link => link.id === p.id && link.squad_id === squad));
  // Include existing attendance for players who have since left this roster.
  const people = [...members, ...records.filter(r => r.subject_user_id && !members.some(p => p.id === r.subject_user_id)).map(r => ({ id: r.subject_user_id!, name: boot.people.find(p => p.id === r.subject_user_id)?.name ?? `Former player #${r.subject_user_id}` }))]
    .filter(person => !historicalVisitors.includes(person.id));
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      const all: OperationRecord[] = [];
      for (let page = 0; page < 30; page++) {
        const rows = await get<OperationRecord[]>(`/clubs/${boot.clubId}/workspace-roles/work?module=ATTENDANCE&squad=${squad}&session=${session}&page=${page}`, c.signal);
        all.push(...rows.filter(r => r.status !== 'CANCELLED'));
        if (rows.length < 100) { if (!c.signal.aborted) { setRecords(all); setError(''); setLoading(false); } return; }
      }
      throw new Error('This register is too large. Open the attendance records to review it.');
    })().catch(e => { if (!c.signal.aborted) { setError(extractApiErrorMessage(e, 'Could not load the session register.')); setLoading(false); } });
    return () => c.abort();
  }, [boot.clubId, session, squad, revision]);
  const setStatus = async (person: { id: number; name: string }, status: string, existing?: OperationRecord, note?: string) => {
    if (lock.current) return; lock.current = true; setBusy(person.id); setError('');
    try {
      let record = existing;
      if (!record) {
        record = await post<OperationRecord>(`${root(boot.clubId)}/records`, { kind: 'ATTENDANCE', title: `${person.name} · ${info?.title ?? 'Training session'}`.slice(0, 160), squadId: squad, sessionId: session, subjectUserId: person.id, data: {} });
        setRecords(rows => [...rows.filter(r => r.id !== record!.id), record!]);
      }
      const updated = await post<OperationRecord>(`${root(boot.clubId)}/records/${record.id}/transition`, { status, revision: record.revision, note: note ?? null });
      setRecords(rows => [...rows.filter(r => r.id !== updated.id), updated]); setCorrection(null); setReason('');
    } catch (e) { setError(extractApiErrorMessage(e, 'Could not update attendance. Reload the register before trying again.')); }
    finally { lock.current = false; setBusy(null); }
  };
  const visible = people.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const count = (status: string) => records.filter(r => r.status === status).length;
  const unrecorded = people.length - people.filter(p => records.some(r => r.subject_user_id === p.id && r.status !== 'EXPECTED')).length;

  return <Panel flush title="Session register" action={<Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setLoading(true); setRevision(v => v + 1); }}><RefreshCw aria-hidden="true" />Reload</Button>}
    footer={<span className="gk-muted">Record collection in a player’s details after checking who may collect them.</span>}>
    <div className="rec-register-head">
      <div className="rec-register-counts" role="status" aria-label="Register totals">
        <Badge tone="accent">{count('ARRIVED')} arrived</Badge><Badge tone="danger">{count('ABSENT')} absent</Badge><Badge tone="accent">{count('COLLECTED')} collected</Badge><Badge>{Math.max(0, unrecorded)} not recorded</Badge>
      </div>
      <SearchInput aria-label="Find a player in the register" placeholder="Find a player" value={query} onChange={e => setQuery(e.target.value)} />
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
      {correction && <form className="gk-notice gk-notice--warning rec-prompt" onSubmit={e => { e.preventDefault(); void setStatus({ id: correction.subject_user_id!, name: '' }, 'EXPECTED', correction, reason); }}>
        <div className="rec-prompt__text"><Field label="Why is this attendance being corrected?" htmlFor="rec-correction"><input id="rec-correction" className="gk-input" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field></div>
        <Button type="submit" size="sm" variant="primary" disabled={busy !== null || !reason.trim()}>Save correction</Button>
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setCorrection(null); setReason(''); }}>Cancel</Button>
      </form>}
    </div>
    {loading ? <div className="cw-skeleton-rows rec-disclosure__body" role="status" aria-label="Loading register">{[0, 1, 2, 3].map(i => <Skeleton key={i} height={44} />)}</div>
      : visible.length ? <List label="Players in this session">{visible.map(p => {
        const record = records.find(r => r.subject_user_id === p.id), status = record?.status ?? 'EXPECTED', canAct = writable && (!record || record.transitions.length > 0);
        return <li key={p.id}><div className="gk-list-row rec-register-row">
          <span className="gk-list-row__lead"><Avatar name={p.name} size={36} /></span>
          <span className="gk-list-row__main"><span className="gk-list-row__title">{p.name}</span><span className="gk-list-row__meta">{busy === p.id ? <span role="status">Saving…</span> : record ? <Badge tone={tone(status)}>{label(status)}</Badge> : 'Not recorded'}</span></span>
          <span className="gk-list-row__trail rec-register-actions">
            {status === 'EXPECTED' && canAct && <>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => { void setStatus(p, 'ARRIVED', record); }} aria-label={`Mark ${p.name} arrived`}><Check aria-hidden="true" />Arrived</Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { void setStatus(p, 'ABSENT', record); }} aria-label={`Mark ${p.name} absent`}><X aria-hidden="true" />Absent</Button>
            </>}
            {record && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => onRecord(record)}>{status === 'ARRIVED' ? 'Collection & details' : 'Details'}</Button>}
            {record && record.transitions.includes('EXPECTED') && writable && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setCorrection(record); setReason(''); }}>Correct</Button>}
          </span>
        </div></li>;
      })}</List>
        : <EmptyNote title={query ? 'No player matches this search' : 'No roster for this session'}>{query ? 'Try another name.' : 'Use the attendance records below to add a player.'}</EmptyNote>}
    {canSeeVisitors && <TrainingVisitorsRegister squad={squad} session={session} revision={revision} onHistoricalPlayers={recordHistoricalPlayers} />}
    {confirmation && <div className="rec-disclosure__body">{confirmation}</div>}
  </Panel>;
}
