import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { LeaveClubDialog } from '../../clubOperations/leaving/LeaveClubDialog';
import { useLeaveStep } from '../../clubOperations/leaving/useLeaveStep';
import './relationship-actions.css';

interface Relationship { clubId: number; clubName: string; staffRole: string | null; playerStatus: string | null; departureSnapshots: Partial<Record<'STAFF' | 'PLAYER' | 'ALL', string>> }

/**
 * Your clubs and how to leave each part. Leaving a club's staff, and the Owner's "Hand the club over", go through the
 * one leave flow (LeaveClubDialog: hand over first, or close the club as its last staff member). A player's place is
 * left here, with its own short confirmation and the club's current departure snapshot.
 */
export function ClubRelationships({ onChanged }: { onChanged?: () => void }) {
  const copy = useJourneyCopy();
  const { refreshNavigationCapabilities } = useAuth();
  const leaveStep = useLeaveStep();
  const [rows, setRows] = useState<Relationship[]>([]), [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<{ row: Relationship; requestId: string; snapshot: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<Relationship[]>('/me/club-relationships', { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setRows(r.data); })
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, copy('Your clubs couldn’t load.', 'თქვენი კლუბები ვერ ჩაიტვირთა.'))); });
    return () => controller.abort();
  }, [attempt, copy]);
  const refresh = () => { setAttempt(v => v + 1); onChanged?.(); };
  const choosePlace = (row: Relationship) => {
    const snapshot = row.departureSnapshots?.PLAYER;
    if (!snapshot) { setError(copy('This changed a moment ago. Try again.', 'ეს ახლახან შეიცვალა. სცადეთ ხელახლა.')); setAttempt(v => v + 1); return; }
    setError(''); setPlaying({ row, requestId: crypto.randomUUID(), snapshot });
  };
  async function leavePlace() {
    if (!playing || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await apiClient.post(`/clubs/${playing.row.clubId}/relationships/PLAYER/leave`, { requestId: playing.requestId, snapshot: playing.snapshot });
      setPlaying(null); refresh();
      await refreshNavigationCapabilities().catch(() => undefined);
    } catch (e) {
      // A changed relationship needs a fresh look; the same request is kept for a plain retry.
      if ((e as { response?: { status?: number } }).response?.status === 409) { setPlaying(null); setAttempt(v => v + 1); }
      setError(extractApiErrorMessage(e, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')));
    } finally { submitting.current = false; setBusy(false); }
  }
  const flowClub = rows.find(row => row.clubId === leaveStep.clubId);
  if (!rows.length && !error) return null;
  return <section className="relationship-panel" aria-label={copy('Your clubs', 'თქვენი კლუბები')}>
    <h2>{copy('Your clubs', 'თქვენი კლუბები')}</h2>
    {error && <p role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt(v => v + 1); }}>{copy('Try again', 'თავიდან')}</button></p>}
    {rows.map(row => <article key={row.clubId} className="sd-panel rc-journey-card">
      <h3><Link to={`/clubs/${row.clubId}`}>{row.clubName}</Link></h3>
      <p>{[row.staffRole && copy('Staff', 'თანამშრომელი'), row.playerStatus && copy('Player', 'მოთამაშე')].filter(Boolean).join(' · ')}</p>
      <div className="relationship-actions">
        {row.staffRole === 'OWNER' && <button type="button" disabled={busy} onClick={() => leaveStep.go('handover', row.clubId)}>{copy('Hand the club over', 'კლუბის გადაცემა')}</button>}
        {row.staffRole && row.staffRole !== 'OWNER' && <button type="button" disabled={busy} onClick={() => leaveStep.go('leave', row.clubId)}>{copy('Leave the staff', 'პერსონალის დატოვება')}</button>}
        {row.playerStatus && <button type="button" disabled={busy} onClick={() => choosePlace(row)}>{copy('Leave the squad', 'გუნდის დატოვება')}</button>}
      </div>
    </article>)}
    {playing && <section className="relationship-confirmation" aria-label={copy('Confirm leaving', 'დატოვების დადასტურება')}>
      <h3>{copy(`Leave your place at ${playing.row.clubName}?`, `დატოვოთ ადგილი ${playing.row.clubName}-ში?`)}</h3>
      <p>{copy('Your playing place ends. Any staff job there stays, and it stays in your career.', 'მოთამაშის ადგილი სრულდება. იქაური სამუშაო რჩება, კარიერაში კი ეს დარჩება.')}</p>
      <div className="relationship-actions">
        <button type="button" disabled={busy} onClick={() => void leavePlace()}>{busy ? copy('Leaving…', 'ტოვებთ…') : copy('Yes, leave', 'დიახ, დატოვება')}</button>
        <button type="button" disabled={busy} onClick={() => setPlaying(null)}>{copy('Stay', 'დარჩენა')}</button>
      </div>
    </section>}
    {flowClub && <LeaveClubDialog clubId={flowClub.clubId} clubName={flowClub.clubName} onDone={() => refresh()} />}
  </section>;
}
