import { useEffect, useState } from 'react';
import { Button } from '../../../design/primitives';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { readFamilyMoney, type MoneyRecord } from '../../clubOperations/money/api';
import { MoneyHistory } from '../../clubOperations/money/MoneyHistory';

export function FamilyMoneyHistory({ club, child, revision = 0 }: { club: number; child: number; revision?: number | string }) {
    return <FamilyMoneySession key={`${club}:${child}:${getAuthSessionId()}`} club={club} child={child} revision={revision} />;
}
function FamilyMoneySession({ club, child, revision }: { club: number; child: number; revision: number | string }) {
    const [session] = useState(getAuthSessionId), [retry, setRetry] = useState(0);
    const key = `${revision}:${retry}`;
    const [result, setResult] = useState<{ key: string; rows?: MoneyRecord[]; failed?: boolean } | null>(null);
    useEffect(() => {
        const c = new AbortController();
        void readFamilyMoney(club, child, c.signal).then(rows => {
            if (!c.signal.aborted && isCurrentAuthSession(session)) setResult({ key, rows });
        }).catch(() => {
            if (!c.signal.aborted && isCurrentAuthSession(session)) setResult({ key, failed: true });
        });
        return () => c.abort();
    }, [club, child, session, key]);
    if (result?.key !== key) return <p role="status">Loading money records…</p>;
    if (result.failed) return <div role="alert"><p>Money records could not load. The current balance is unavailable.</p><Button size="sm" className="club-money__refresh" onClick={() => setRetry(v => v + 1)}>Retry money records</Button></div>;
    const rows = result.rows ?? [];
    return <div className="gk-stack">
        {!rows.length ? <p className="ph-quiet">No agreed dues recorded here. Ask the club about any outside arrangements.</p>
            : rows.map(row => <section key={row.id} aria-label={row.title}><h4>{row.title}</h4><MoneyHistory record={row} /></section>)}
        <Button size="sm" className="club-money__refresh" onClick={() => setRetry(v => v + 1)}>Refresh money records</Button>
    </div>;
}
