import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import type { SquadJoinRequest } from '../squadCommunication/api';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { answerHomeJoin, readHomeJoins } from './homePendingApi';
import { homeJoinCommands } from './homePendingCommands';

/** Each observed request uses its existing versioned domain command; retries keep their own command id. */
export function HomeJoinActions({ squad, session, changed }: { squad: number; session: AuthSessionId; changed: () => void }) {
    const copy = useJourneyCopy();
    const [items, setItems] = useState<SquadJoinRequest[] | null>(null), [failed, setFailed] = useState(false);
    const [round, setRound] = useState(0), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    const [group, setGroup] = useState<number | null>(null);
    const [command] = useState(() => homeJoinCommands(session, squad));
    const operation = useRef<AbortController | null>(null);
    const submitting = useRef(false);
    useEffect(() => () => operation.current?.abort(), []);
    useEffect(() => {
        const abort = new AbortController();
        void readHomeJoins(squad, session, abort.signal).then(rows => { if (!abort.signal.aborted && isCurrentAuthSession(session)) { setItems(rows); setFailed(false); } })
            .catch(() => { if (!abort.signal.aborted && isCurrentAuthSession(session)) setFailed(true); });
        return () => abort.abort();
    }, [squad, session, round]);
    const groups = (items?.[0]?.groups ?? []).filter(g => items?.every(item => item.groups.some(candidate => candidate.id === g.id && candidate.version === g.version)));
    const chosen = groups.find(g => g.id === group) ?? groups[0];
    const forItem = (item: SquadJoinRequest) => chosen ?? (item.groups.length === 1 ? item.groups[0] : null);
    const canApprove = !!items?.length && items.every(item => forItem(item));
    const approve = async () => {
        if (!items?.length || !canApprove || submitting.current || !isCurrentAuthSession(session)) return;
        submitting.current = true; setBusy(true); setMessage('');
        const abort = new AbortController(); operation.current = abort;
        let offered = 0, other = 0, failedCount = 0;
        for (const item of items) {
            if (abort.signal.aborted || !isCurrentAuthSession(session)) return;
            const into = forItem(item)!;
            const key = `${item.source}:${item.id}:${item.version}:${into.id}:${into.version}`;
            try {
                const result = await answerHomeJoin(squad, item, { action: 'APPROVE', expectedVersion: item.version, requestId: command(key), groupId: into.id, groupVersion: into.version }, session, abort.signal);
                if (result.outcome === 'PLACE_OFFERED') offered++; else other++;
            } catch { failedCount++; }
        }
        if (!abort.signal.aborted && isCurrentAuthSession(session)) {
            setMessage(copy(`${offered} offered a place · ${other} other outcomes · ${failedCount} could not be confirmed. Families accept the terms next.`, `ადგილი შეთავაზებულია: ${offered} · სხვა შედეგი: ${other} · ვერ დადასტურდა: ${failedCount}. შემდეგ ოჯახები პირობებს ეთანხმებიან.`));
            setBusy(false); submitting.current = false; setRound(n => n + 1); changed();
        }
    };
    return <div className="home-waiting__actions">
        {canApprove && !!items?.length && <>
            {chosen && groups.length > 1 && <select aria-label={copy('Approve into', 'ჯგუფი')} disabled={busy} value={chosen.id} onChange={e => setGroup(Number(e.target.value))}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
            <button type="button" disabled={busy || failed} onClick={() => void approve()}>{copy(`Approve all ${items.length}`, `ყველას დადასტურება (${items.length})`)}</button>
        </>}
        <Link to={`/squads/${squad}?tab=players&invite=1`}>{copy('Review each request', 'მოთხოვნების განხილვა')}</Link>
        {failed && <span role="alert">{copy('Requests could not load.', 'მოთხოვნები ვერ ჩაიტვირთა.')} <button onClick={() => setRound(n => n + 1)}>{copy('Retry', 'ხელახლა ცდა')}</button></span>}
        {message && <p role="status">{message}</p>}
    </div>;
}
