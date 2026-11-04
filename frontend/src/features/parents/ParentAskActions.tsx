import { useEffect, useState } from 'react';
import type { NotificationItem } from '../../types/notifications';
import { Button } from '../../design/primitives';
import { extractApiErrorMessage } from '../../utils/apiError';
import { formatDate } from '../../utils/formatting';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { answerParentAsk, changeParentAskToYes, fetchParentAsk, type ParentAsk } from './familyLinks';

/**
 * "Maia says they're Nika's parent": every Owner and Admin of the club answers in place, and never the person asking
 * (the server doesn't offer it to them). The first answer counts; a later one gets the server's plain words. A no that
 * turns out wrong can be changed to a yes.
 */
export function ParentAskActions({ notification }: { notification: NotificationItem }) {
    const copy = useJourneyCopy();
    const id = notification.type === 'FAMILY_PARENT_ASK' ? notification.entityId ?? null : null;
    const [ask, setAsk] = useState<ParentAsk | null>(null);
    const [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
    useEffect(() => {
        if (id == null) return;
        const controller = new AbortController();
        fetchParentAsk(id, controller.signal).then(found => { if (!controller.signal.aborted) setAsk(found); }).catch(() => { /* Opening the notice still leads to the player. */ });
        return () => controller.abort();
    }, [id]);
    if (id == null || !ask?.canAnswer) return null;
    const day = ask.answeredAt ? formatDate(ask.answeredAt, { day: 'numeric', month: 'short' }) : '';
    const answer = async (yes: boolean, changing = false) => {
        if (busy) return;
        setBusy(true); setError('');
        try {
            await (changing ? changeParentAskToYes(id) : answerParentAsk(id, yes));
            setDone(yes ? copy(`${ask.adultName} is ${ask.childName}’s parent here now.`, `${ask.adultName} ახლა ${ask.childName}-ის მშობელია აქ.`) : copy(`${ask.adultName} isn’t ${ask.childName}’s parent here. They’re told.`, `${ask.adultName} აქ ${ask.childName}-ის მშობელი არ არის. ეცნობება.`));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {done ? <p className="gk-faint" role="status">{done}</p>
            : ask.status === 'NO' && ask.canChangeNo ? <div className="gk-row">
                <small className="gk-muted">{copy(`${ask.answeredBy ?? 'Someone'} said no · ${day}`, `${ask.answeredBy ?? 'ვიღაცამ'} უარი თქვა · ${day}`)}</small>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void answer(true, true)}>{copy(`I know ${ask.adultName} is ${ask.childName}’s parent`, `ვიცი, რომ ${ask.adultName} ${ask.childName}-ის მშობელია`)}</Button>
            </div>
            : ask.status !== 'WAITING' ? <p className="gk-faint" role="status">{copy(`${ask.answeredBy ?? 'Someone'} already answered.`, `${ask.answeredBy ?? 'ვიღაცამ'} უკვე უპასუხა.`)}</p>
            : <div className="gk-row">
                <Button size="sm" variant="primary" disabled={busy} onClick={() => void answer(true)}>{copy(`I know ${ask.adultName} is ${ask.childName}’s parent`, `ვიცი, რომ ${ask.adultName} ${ask.childName}-ის მშობელია`)}</Button>
                <Button size="sm" variant="ghost" className="pp-danger" disabled={busy} onClick={() => void answer(false)}>{copy('Not their parent', 'არ არის მშობელი')}</Button>
            </div>}
        {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
    </div>;
}
