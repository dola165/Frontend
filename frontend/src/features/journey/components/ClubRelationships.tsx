import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import './relationship-actions.css';

interface Relationship { clubId: number; clubName: string; staffRole: string | null; playerStatus: string | null; departureSnapshots: Record<Scope, string> }
type Scope = 'STAFF' | 'PLAYER' | 'ALL';
const labels: Record<Scope, string> = { STAFF: 'End staff membership', PLAYER: 'End playing membership', ALL: 'Leave all club responsibilities' };
export function ClubRelationships({ onChanged }: { onChanged?: () => void }) {
  const { refreshNavigationCapabilities } = useAuth();
  const [rows, setRows] = useState<Relationship[]>([]), [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<{ row: Relationship; scope: Scope; requestId: string; snapshot: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<Relationship[]>('/me/club-relationships', { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setRows(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load club responsibilities.')); });
    return () => controller.abort();
  }, [attempt]);
  function select(row: Relationship, scope: Scope) {
    const snapshot = row.departureSnapshots?.[scope];
    if (!snapshot) { setError('Refresh your club responsibilities before confirming departure.'); return; }
    setError('');
    setSelection({ row, scope, requestId: crypto.randomUUID(), snapshot });
  }
  async function leave() {
    if (!selection || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await apiClient.post(`/clubs/${selection.row.clubId}/relationships/${selection.scope}/leave`, { requestId: selection.requestId, snapshot: selection.snapshot });
      setSelection(null); setAttempt(v => v + 1);
      onChanged?.();
      await refreshNavigationCapabilities().catch(() => setError('Membership updated. Reload to refresh your navigation.'));
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 409) {
        setSelection(null); setAttempt(v => v + 1);
      }
      setError(extractApiErrorMessage(e, 'Could not end this relationship.'));
    }
    finally { submitting.current = false; setBusy(false); }
  }
  if (!rows.length && !error) return null;
  return <section className="relationship-panel" aria-label="Club responsibilities">
    <h2>Club responsibilities</h2>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt(v => v + 1); }}>Retry loading</button></p>}
    {rows.map(row => <article key={row.clubId} className="sd-panel rc-journey-card">
      <h3><Link to={`/clubs/${row.clubId}`}>{row.clubName}</Link></h3>
      <p>{[row.staffRole && `Staff: ${row.staffRole.toLowerCase().replaceAll('_', ' ')}`, row.playerStatus && `Player: ${row.playerStatus.toLowerCase()}`].filter(Boolean).join(' · ')}</p>
      <div className="relationship-actions">
        {row.staffRole && row.staffRole !== 'OWNER' && <button type="button" disabled={busy} onClick={() => select(row, 'STAFF')}>{labels.STAFF}</button>}
        {row.playerStatus && <button type="button" disabled={busy} onClick={() => select(row, 'PLAYER')}>{labels.PLAYER}</button>}
        {row.staffRole && row.playerStatus && row.staffRole !== 'OWNER' && <button type="button" disabled={busy} onClick={() => select(row, 'ALL')}>{labels.ALL}</button>}
      </div>
      {row.staffRole === 'OWNER' && <p>Transfer ownership in the club workspace before ending your staff membership.</p>}
    </article>)}
    {selection && <section className="relationship-confirmation" aria-label="Confirm departure">
      <h3>{labels[selection.scope]} at {selection.row.clubName}?</h3>
      <p>{selection.scope === 'STAFF' ? 'Your staff access and coaching assignments will end. Your playing membership and squad place will remain.' : selection.scope === 'PLAYER' ? 'Your playing membership and playing squad places will end. Your staff responsibilities will remain.' : 'Your staff access, coaching assignments, playing membership and playing squad places will end.'}</p>
      <div className="relationship-actions"><button type="button" disabled={busy} onClick={() => void leave()}>{busy ? 'Updating…' : 'Confirm departure'}</button><button type="button" disabled={busy} onClick={() => setSelection(null)}>Keep membership</button></div>
    </section>}
  </section>;
}
