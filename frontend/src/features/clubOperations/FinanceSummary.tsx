import { useEffect, useState } from 'react';
import { StatTile } from '../../design/primitives';
import { get, root } from './api';

interface Summary { currency: string; budget: number; committed: number; spent: number; membership_due: number; membership_recorded: number }
const money = (amount: number) => Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recorded totals per currency, within the records this person may see. Currencies are never added together. */
export function FinanceSummary({ club, revision }: { club: number; revision: unknown }) {
  const [data, setData] = useState<Summary[]>([]), [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void get<Summary[]>(`${root(club)}/finance-summary`, c.signal).then(r => { setData(r); setError(false); }).catch(() => { if (!c.signal.aborted) setError(true); });
    return () => c.abort();
  }, [club, revision]);
  if (error) return <div className="gk-notice" role="status">Finance totals are unavailable.</div>;
  return <>{data.map(s => <section key={s.currency} className="gk-stack gk-stack--tight" aria-label={`${s.currency} recorded finances`}>
    <div className="gk-stats">
      <StatTile label={`Active budgets · ${s.currency}`} value={money(s.budget)} />
      <StatTile label="Approved expenses" value={money(s.committed)} />
      <StatTile label="Settled expenses" value={money(s.spent)} />
      <StatTile label="Membership due" value={money(s.membership_due)} tone={s.membership_due > s.membership_recorded ? 'attention' : undefined} />
      <StatTile label="Membership recorded" value={money(s.membership_recorded)} />
    </div>
    <p className="gk-faint">Totals cover the records within your access. Currencies are kept separate.</p>
  </section>)}</>;
}
