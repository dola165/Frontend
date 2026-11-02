import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { fetchLookAlikes, fetchMerges, joinCards, type LookAlike, type PersonMerge } from '../familyLinks';
import './parent-hub.css';

const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0];

/**
 * One child, one card (owner, 2 November 2026): two of my cards that look like one child ("Join them"), and joins
 * that wait for my answer. Shown like "Waiting for you", and only when there is something.
 */
export function OneCard({ revision }: { revision: number }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [alike, setAlike] = useState<LookAlike[]>([]);
    const [waiting, setWaiting] = useState<PersonMerge[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [asking, setAsking] = useState<string | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchLookAlikes(controller.signal).then(setAlike).catch(() => setAlike([]));
        fetchMerges(controller.signal).then(all => setWaiting(all.filter(m => m.status === 'PROPOSED' && m.waitingForMe))).catch(() => setWaiting([]));
        return () => controller.abort();
    }, [revision]);
    if (!alike.length && !waiting.length) return null;
    const join = async (pair: LookAlike) => {
        const key = `${pair.personId}:${pair.otherId}`;
        if (busy) return;
        setBusy(key); setError('');
        try { navigate(`/merge/${(await joinCards(pair.personId, pair.otherId)).id}`); }
        catch (failure) {
            setError(extractApiErrorCode(failure) === 'MERGE_BIRTH_DATE'
                ? copy('These two cards have different birth dates. Fix the wrong one in the child’s details first.', 'ამ ბარათებზე სხვადასხვა დაბადების თარიღია. ჯერ ბავშვის დეტალებში გაასწორეთ არასწორი.')
                : extractApiErrorMessage(failure, copy('That didn’t work. Try again.', 'ვერ მოხერხდა. სცადეთ ხელახლა.')));
        } finally { setBusy(null); }
    };
    return <section className="ph-waiting" aria-label={copy('One card for each child', 'თითო ბარათი თითო ბავშვს')}>
        <ul className="ph-rows">
            {alike.map(pair => { const key = `${pair.personId}:${pair.otherId}`; return <li key={key}>{asking === key
                ? <div className="ph-row" role="group" aria-label={copy(`Join ${first(pair.personName)}’s two cards`, `${first(pair.personName)}-ის ბარათების გაერთიანება`)}>
                    <span className="ph-dot ph-dot--decide" aria-hidden="true" />
                    <span className="ph-row__text"><strong>{copy('Join the two cards into one?', 'გავაერთიანოთ ორი ბარათი?')}</strong><small>{copy('Everything moves to one card. You can undo it for 30 days.', 'ყველაფერი ერთ ბარათზე გადავა. 30 დღის განმავლობაში შეგიძლიათ გააუქმოთ.')}</small></span>
                    <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => void join(pair)}>{copy('Join', 'გაერთიანება')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setAsking(null)}>{copy('Cancel', 'გაუქმება')}</Button>
                </div>
                : <button type="button" className="ph-row" disabled={busy !== null} onClick={() => setAsking(key)}>
                    <span className="ph-dot ph-dot--decide" aria-hidden="true" />
                    <span className="ph-row__text"><strong>{copy(`${first(pair.personName)} has two cards`, `${first(pair.personName)}-ს ორი ბარათი აქვს`)}</strong><small>{copy('They look like the same child. Join them so everything is in one place.', 'ერთი და იგივე ბავშვი ჩანს. გააერთიანეთ, რომ ყველაფერი ერთ ადგილას იყოს.')}</small></span>
                    <span className="ph-step ph-step--decide">{copy('Join them', 'გაერთიანება')}</span>
                    <ArrowRight aria-hidden="true" />
                </button>}</li>; })}
            {waiting.map(merge => <li key={merge.id}><Link className="ph-row" to={`/merge/${merge.id}`}>
                <span className="ph-dot ph-dot--decide" aria-hidden="true" />
                <span className="ph-row__text"><strong>{copy(`Is this ${first(merge.keptName)}?`, `ეს ${first(merge.keptName)}-ია?`)}</strong><small>{merge.clubName ?? merge.proposedByName ?? ''}</small></span>
                <span className="ph-step ph-step--decide">{copy('Decide', 'გადაწყვიტეთ')}</span>
                <ArrowRight aria-hidden="true" />
            </Link></li>)}
        </ul>
        {error && <p role="alert" className="ph-failed">{error}</p>}
    </section>;
}
