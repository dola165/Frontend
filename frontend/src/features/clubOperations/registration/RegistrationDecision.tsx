import { useRef, useState } from 'react';
import { Button, Field, Panel } from '../../../design/primitives';
import { assertCurrentAuthSession, getAuthSessionId } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { transitionLabel, type OperationRecord } from '../api';
import { useClubEditorClose } from '../useClubEditorClose';
import { decideRegistration, type RegistrationDecision as Command } from './api';
import './registration.css';

export function RegistrationDecision({ club, record, onChanged, onRefreshHistory }: { club: number; record: OperationRecord; onChanged: () => Promise<void>; onRefreshHistory?: () => Promise<number> }) {
  const [session] = useState(getAuthSessionId);
  const marker = `gk-registration-decision:${session}:${club}:${record.id}`;
  const [blocked, setBlocked] = useState(() => { try { return !!sessionStorage.getItem(marker); } catch { return false; } });
  const [reviewed, setReviewed] = useState<number | null>(null);
  const [note, setNote] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Command | null>(null), [saved, setSaved] = useState(false);
  const running = useRef(false);
  const guard = useClubEditorClose(!saved && (!!note || !!pending), busy, () => undefined);
  const refreshHistory = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setReviewed(null); setError('');
    try {
      assertCurrentAuthSession(session);
      if (!onRefreshHistory) throw new Error('Current history is unavailable.');
      const revision = await onRefreshHistory();
      assertCurrentAuthSession(session); setReviewed(revision);
    } catch { setError('Current record and history could not load. Keep the unresolved decision.'); }
    finally { running.current = false; setBusy(false); }
  };
  const decide = async (status: string) => {
    if (running.current || blocked || saved || !note.trim()) return;
    running.current = true; setBusy(true); setError('');
    const command = pending ?? { requestId: crypto.randomUUID(), revision: record.revision, status, note: note.trim() };
    try {
      assertCurrentAuthSession(session);
      setPending(command); try { sessionStorage.setItem(marker, command.requestId); } catch { /* The exact command stays in memory. */ }
      await decideRegistration(club, record.id, command, session);
      assertCurrentAuthSession(session);
      try { sessionStorage.removeItem(marker); } catch { /* No private payload is stored. */ } setPending(null); setSaved(true);
      try { await onChanged(); } catch { setError('Decision recorded. Refresh the record to see its current state.'); }
    } catch (e) {
      const code = (e as { response?: { status?: number } }).response?.status;
      if (!pending && code && [400, 401, 403, 404, 422].includes(code)) { try { sessionStorage.removeItem(marker); } catch { /* The next fresh read still checks authority. */ } setPending(null); }
      setError(extractApiErrorMessage(e, 'The decision response was not confirmed. Retry checks the same request.'));
    } finally { running.current = false; setBusy(false); }
  };
  return <section className="registration"><Panel padded title="Review outcome">
    <p>The reviewer records the actual evidence and reason. Expiry and linked credential status are calculated automatically.</p>
    {blocked && <p role="alert">An earlier decision has an unknown outcome. Refresh and review its history before another action.</p>}
    {error && <p role="alert">{error}</p>}{saved && <p role="status">Decision recorded.</p>}
    <Field label="Review outcome and reason" htmlFor="registration-decision"><textarea id="registration-decision" className="gk-input" maxLength={2000} required value={note} disabled={busy || !!pending || saved || blocked} onChange={e => setNote(e.target.value)} /></Field>
    <div className="registration__actions">{pending ? <Button disabled={busy} onClick={() => void decide(pending.status)}>Retry the same decision</Button>
      : record.transitions.map(status => <Button key={status} disabled={busy || saved || blocked || !note.trim()} onClick={() => void decide(status)}>{status === 'APPROVED' ? 'Record supported approval' : transitionLabel(record.kind, status)}</Button>)}
      {(blocked || saved || error) && <Button disabled={busy} onClick={() => void refreshHistory()}>Refresh record and history</Button>}
      {(blocked || pending) && reviewed === record.revision && <Button disabled={busy} onClick={() => { try { sessionStorage.removeItem(marker); } catch { /* A later remount may require another history check. */ } setPending(null); setNote(''); setBlocked(false); setReviewed(null); }}>History reviewed; enable a new decision</Button>}</div>
  </Panel>{guard.confirmation}</section>;
}
