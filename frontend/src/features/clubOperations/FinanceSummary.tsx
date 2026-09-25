import { useEffect, useState } from 'react';
import { get, root } from './api';
interface Summary { currency:string;budget:number;committed:number;spent:number;membership_due:number;membership_recorded:number }
export function FinanceSummary({club,revision}:{club:number;revision:unknown}) {
  const [data,setData]=useState<Summary[]>([]),[error,setError]=useState(false);
  useEffect(()=>{const c=new AbortController();void get<Summary[]>(`${root(club)}/finance-summary`,c.signal).then(r=>{setData(r);setError(false);}).catch(()=>{if(!c.signal.aborted)setError(true);});return()=>c.abort();},[club,revision]);
  return error?<p role="status">Finance totals are unavailable.</p>:<div className="ops-grid ops-editor">{data.map(s=><section className="ops-card" key={s.currency}><h3>{s.currency} · Recorded finances</h3><dl>{[['Active budgets',s.budget],['Approved expenses',s.committed],['Settled expenses',s.spent],['Membership due',s.membership_due],['Membership payments recorded',s.membership_recorded]].map(([name,amount])=><div className="ops-row" key={name}><dt>{name}</dt><dd>{Number(amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</dd></div>)}</dl><p className="ops-muted">Totals cover the records within your access. Currencies are kept separate.</p></section>)}</div>;
}
