import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { Button, Field, Panel, Skeleton } from '../../design/primitives';
import './records/records.css';

interface Policy { cutoffOn: string | null; effectiveCutoff: string; revision: number; rule: string }

/** The season cutoff that decides which youth category a player belongs to. Saved with its revision so concurrent edits are caught. */
export function SquadAgePolicy({ club, squad }: { club: number; squad: number }) {
  const [policy, setPolicy] = useState<Policy | null>(null), [cutoff, setCutoff] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void apiClient.get<Policy>(`/clubs/${club}/squads/${squad}/age-policy`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) { setPolicy(r.data); setCutoff(r.data.cutoffOn ?? ''); } })
      .catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load the age policy.')); });
    return () => controller.abort();
  }, [club, squad]);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!policy || busy) return;
    setBusy(true); setError(''); setSaved(false);
    try { const r = await apiClient.put<Policy>(`/clubs/${club}/squads/${squad}/age-policy`, { cutoffOn: cutoff || null, revision: policy.revision }); setPolicy(r.data); setSaved(true); }
    catch (failure) { setError(extractApiErrorMessage(failure, 'Could not update the age policy.')); }
    finally { setBusy(false); }
  }
  return <Panel flush title="Age eligibility and season cutoff">
    <form className="rec-form__group" onSubmit={e => { void save(e); }}>
      <p className="gk-muted">Youth categories require players to be under the stated age on this date. Squad eligibility and competition rules are checked separately.</p>
      {error && <div className="gk-notice gk-notice--danger" role="alert">{error}</div>}
      {saved && <div className="gk-notice cw-notices__success" role="status">Season cutoff saved.</div>}
      {!policy && !error ? <Skeleton height={64} /> : policy && <>
        <dl className="rec-facts rec-facts--bare"><div><dt>Cutoff in use</dt><dd className="gk-num">{policy.effectiveCutoff}</dd></div><div><dt>Set for this squad</dt><dd>{policy.cutoffOn ?? 'No, the club’s admission date applies'}</dd></div></dl>
        <div className="rec-fields">
          <Field label="Season cutoff date" htmlFor={`age-cutoff-${squad}`} hint="Leave blank to use the club’s admission date."><input id={`age-cutoff-${squad}`} className="gk-input" type="date" disabled={busy} value={cutoff} onChange={e => { setCutoff(e.target.value); setSaved(false); }} /></Field>
        </div>
        <div><Button type="submit" variant="primary" disabled={busy || cutoff === (policy.cutoffOn ?? '')}>{busy ? 'Saving…' : 'Save age policy'}</Button></div>
      </>}
    </form>
  </Panel>;
}
