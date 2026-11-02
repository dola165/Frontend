import { useEffect, useState } from 'react';
import { StatTile } from '../../design/primitives';
import { get, root } from './api';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';

interface Summary { currency: string | null; budget: number | null; committed: number | null; spent: number | null; membership_due: number | null; membership_recorded: number | null; reminder_candidates?: number }
const money = (amount: number | null, currency: string | null) => amount == null || !currency ? 'Unknown' : Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recorded totals per currency, within the records this person may see. Currencies are never added together. */
export function FinanceSummary({ club, revision }: { club: number; revision: unknown }) {
  return <FinanceSummarySession key={`${club}:${getAuthSessionId()}`} club={club} revision={revision} />;
}
function FinanceSummarySession({ club, revision }: { club: number; revision: unknown }) {
  const [session] = useState(getAuthSessionId);
  const [data, setData] = useState<Summary[]>([]), [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void get<Summary[]>(`${root(club)}/finance-summary`, c.signal).then(r => { if (!c.signal.aborted && isCurrentAuthSession(session)) { setData(r); setError(false); } }).catch(() => { if (!c.signal.aborted) setError(true); });
    return () => c.abort();
  }, [club, revision, session]);
  if (error) return <div className="gk-notice" role="status">Finance totals are unavailable.</div>;
  return <>{data.map(s => <section key={s.currency} className="gk-stack gk-stack--tight" aria-label={`${s.currency} recorded finances`}>
    <div className="gk-stats">
      <StatTile label={`Active budgets · ${s.currency ?? 'Currency unknown'}`} value={money(s.budget, s.currency)} />
      <StatTile label="Approved expenses" value={money(s.committed, s.currency)} />
      <StatTile label="Settled expenses" value={money(s.spent, s.currency)} />
      <StatTile label="Membership remaining" value={money(s.membership_due, s.currency)} tone={s.membership_due != null && s.membership_due > 0 ? 'attention' : undefined} />
      <StatTile label="Outside receipts recorded" value={money(s.membership_recorded, s.currency)} />
    </div>
    <p className="gk-faint">Totals cover the records within your access. Currencies are kept separate.</p>
  </section>)}</>;
}
