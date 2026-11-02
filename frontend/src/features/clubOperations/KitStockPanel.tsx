import { useEffect, useState } from 'react';
import { Button, Panel } from '../../design/primitives';
import { getAuthSessionId, isCurrentAuthSession } from '../../utils/authStorage';
import { get, label, root } from './api';
import './money/money.css';

interface Stock { id: number; title: string; count: { total: number | null; issued: number | null; lost: number | null; available: number | null; shortage: number | null; status: string } }
export function KitStockPanel({ club, revision }: { club: number; revision: unknown }) {
    const [session] = useState(getAuthSessionId);
    const [state, setState] = useState<{ club: number; rows: Stock[] } | null>(null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
    useEffect(() => {
        const c = new AbortController();
        void get<Stock[]>(`${root(club)}/kit-stock`, c.signal).then(rows => { if (!c.signal.aborted && isCurrentAuthSession(session)) { setState({ club, rows }); setError(false); } }).catch(() => { if (!c.signal.aborted) setError(true); });
        return () => c.abort();
    }, [club, revision, retry, session]);
    return <Panel padded title="Kit availability"><div className="club-money gk-stack">
        {error ? <div role="alert">Stock could not load. <Button onClick={() => setRetry(v => v + 1)}>Retry stock</Button></div> : !state || state.club !== club ? <p role="status">Loading stock…</p>
            : !state.rows.length ? <p>Add club equipment when you want to track stock and borrowing.</p> : state.rows.map(row => <section key={row.id} aria-label={row.title}>
                <h3>{row.title}</h3><p>{label(row.count.status)}</p>
                <dl className="club-money__balance">{([['Total', row.count.total], ['Borrowed', row.count.issued], ['Lost', row.count.lost], ['Available', row.count.available]] as const).map(([name, count]) => <div key={name}><dt>{name}</dt><dd>{count ?? 'Unknown'}</dd></div>)}</dl>
                {row.count.shortage != null && row.count.shortage > 0 ? <p role="status">Recorded assignments exceed stock by {row.count.shortage}. Review the stock history.</p> : row.count.available === 0 && <p role="status">No stock available for another issue.</p>}
            </section>)}
    </div></Panel>;
}
