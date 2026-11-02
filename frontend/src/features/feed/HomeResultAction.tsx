import { useEffect, useRef, useState } from 'react';
import { isCurrentAuthSession, type AuthSessionId } from '../../utils/authStorage';
import type { RequestItem } from '../requests/api';
import { ScoreDialog } from '../scores/ScoreDialog';
import { getScoreRecord, writeScore, type ScoreRecord, type ScoreTarget } from '../scores/api';
import { refreshResultsWaiting } from '../actions/useResultsWaiting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';

/** Canonical Inbox selects the work; its existing score command checks the displayed version. */
export function HomeResultAction({ item, session, changed }: { item: RequestItem; session: AuthSessionId; changed: () => void }) {
    const copy = useJourneyCopy();
    const target: ScoreTarget = { kind: item.destination.startsWith('/calendar?') ? 'CALENDAR' : 'EXCHANGE', eventId: item.id };
    const [record, setRecord] = useState<ScoreRecord | null>(null), [failed, setFailed] = useState(false), [round, setRound] = useState(0);
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const operation = useRef<AbortController | null>(null), submitting = useRef(false);
    const command = useRef({ revision: -1, id: crypto.randomUUID() });
    useEffect(() => () => operation.current?.abort(), []);
    useEffect(() => {
        if (item.actionLabel !== 'CONFIRM') return;
        const abort = new AbortController();
        void getScoreRecord({ kind: target.kind, eventId: target.eventId }, abort.signal, session)
            .then(value => { if (!abort.signal.aborted) { setRecord(value); setFailed(false); } })
            .catch(() => { if (!abort.signal.aborted) { setRecord(null); setFailed(true); } });
        return () => abort.abort();
    }, [target.kind, target.eventId, item.actionLabel, session, round]);
    const refresh = () => { changed(); refreshResultsWaiting(); setRound(n => n + 1); };
    const confirm = async () => {
        if (!record?.permissions.respond.length || submitting.current || !isCurrentAuthSession(session)) return;
        submitting.current = true; setBusy(true); setFailed(false);
        const abort = new AbortController(); operation.current = abort;
        if (command.current.revision !== record.revision) command.current = { revision: record.revision, id: crypto.randomUUID() };
        try {
            await writeScore(target, { action: 'confirm', body: { side: record.permissions.respond[0], revision: record.revision, requestId: command.current.id } }, abort.signal, session);
            if (!abort.signal.aborted && isCurrentAuthSession(session)) refresh();
        } catch { if (!abort.signal.aborted && isCurrentAuthSession(session)) { setFailed(true); setRecord(null); changed(); } }
        finally { if (!abort.signal.aborted && isCurrentAuthSession(session)) { setBusy(false); submitting.current = false; } }
    };
    const goals = record?.reported;
    return <div className="home-waiting__actions">
        {item.actionLabel === 'CONFIRM' && <button type="button" disabled={busy || failed || !record?.permissions.respond.length || goals?.homeScore == null || goals.awayScore == null} onClick={() => void confirm()}>{copy('Confirm', 'დადასტურება')}{goals?.homeScore != null && goals.awayScore != null ? ` ${goals.homeScore}–${goals.awayScore}` : ''}</button>}
        <button type="button" disabled={busy} onClick={() => setOpen(true)}>{copy(item.actionLabel === 'CONFIRM' ? 'Review or dispute' : 'Open result', item.actionLabel === 'CONFIRM' ? 'განხილვა ან გასაჩივრება' : 'შედეგის გახსნა')}</button>
        {failed && <span role="alert">{copy('The result could not be confirmed.', 'შედეგი ვერ დადასტურდა.')} <button type="button" onClick={() => setRound(n => n + 1)}>{copy('Reload', 'ხელახლა ჩატვირთვა')}</button></span>}
        {open && <ScoreDialog target={target} title={item.context} description={item.context} onClose={() => setOpen(false)} onChanged={refresh} />}
    </div>;
}
