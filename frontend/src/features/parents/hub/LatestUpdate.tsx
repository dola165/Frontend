import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Avatar, Button, Skeleton } from '../../../design/primitives';
import { MessageText } from '../../../components/chat/MessageText';
import { extractApiErrorMessage } from '../../../utils/apiError';
import * as api from '../../squadCommunication/api';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { relativeTime } from './relativeTime';

type Latest = { squad: api.SquadOverview; message: api.SquadMessage };

/**
 * The newest coach update across the child's squads, readable in place. When the coach asked families to
 * acknowledge it, the one action is "I've read it"; until then it is "not acknowledged", never "not read" (F19).
 */
export function LatestUpdate({ squads, playerId }: { squads: api.SquadOverview[]; playerId: number }) {
    const copy = useJourneyCopy();
    const [latest, setLatest] = useState<{ key: string; value: Latest | null; error: string } | null>(null);
    const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
    const key = squads.map(squad => squad.id).join(',');
    useEffect(() => {
        const abort = new AbortController();
        void Promise.all(squads.map(async squad => (await api.messages(squad.id, 'ANNOUNCEMENT', null, abort.signal)).map(message => ({ squad, message }))))
            .then(rows => { if (!abort.signal.aborted) setLatest({ key, value: rows.flat().sort((a, b) => Date.parse(b.message.created_at) - Date.parse(a.message.created_at))[0] ?? null, error: '' }); })
            .catch(e => { if (!abort.signal.aborted) setLatest({ key, value: null, error: extractApiErrorMessage(e, copy('Coach updates could not load.', 'მწვრთნელის განახლებები ვერ ჩაიტვირთა.')) }); });
        return () => abort.abort();
        // `key` names the squads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, revision, copy]);
    if (!latest || latest.key !== key) return <section className="ph-update" aria-busy="true"><Skeleton height={96} /></section>;
    if (!latest.value) return latest.error ? <p className="ph-quiet" role="alert">{latest.error}</p> : null;
    const { squad, message } = latest.value;
    const acknowledge = async () => {
        setBusy(true); setActionError('');
        try { await api.acknowledge(squad.id, message.id); setRevision(n => n + 1); }
        catch (e) { setActionError(extractApiErrorMessage(e, copy('Could not save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <article className="ph-update" aria-label={copy('Latest coach update', 'მწვრთნელის ბოლო განახლება')}>
        <header className="ph-update__head"><Avatar name={message.author_name} size={32} />
            <span><strong>{message.author_name}</strong><small>{squad.name} · {relativeTime(message.created_at)}</small></span></header>
        {message.title && <h3 className="ph-update__title">{message.title}</h3>}
        <p className="ph-update__body"><MessageText text={message.body} /></p>
        <footer className="ph-update__foot">
            {message.acknowledgement_requested && (message.acknowledged_at
                ? <span className="ph-done"><Check aria-hidden="true" />{copy('Acknowledged', 'დადასტურებულია')}</span>
                : <><span className="ph-wait"><span className="ph-dot" aria-hidden="true" />{copy('Not acknowledged', 'დაუდასტურებელია')}</span>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void acknowledge()}><Check aria-hidden="true" />{copy('I’ve read it', 'წავიკითხე')}</Button></>)}
            <Link className="ph-link ph-update__all" to={`/squads/${squad.id}?player=${playerId}`}>{copy('All updates', 'ყველა განახლება')}</Link>
        </footer>
        {actionError && <p className="ph-next__note ph-next__note--error" role="alert">{actionError}</p>}
    </article>;
}
