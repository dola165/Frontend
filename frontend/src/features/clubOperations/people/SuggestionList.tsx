import { Button } from '../../../design/primitives';
import { relativeTime } from '../../../utils/relativeTime';
import type { AssistantSuggestion } from './api';
import { useJobWords } from './jobWords';

/**
 * Suggested assistants still waiting: admins Confirm or Decline right here (the same choice as in their notification;
 * the first answer counts), and the head coach who suggested someone can withdraw it.
 */
export function SuggestionList({ suggestions, me, admin, busy, onDecide }: {
    suggestions: AssistantSuggestion[]; me: number; admin: boolean; busy: boolean;
    onDecide: (suggestion: AssistantSuggestion, decision: 'confirm' | 'decline' | 'withdraw') => void;
}) {
    const { copy, jobName } = useJobWords();
    const shown = suggestions.filter(s => admin || s.suggestedById === me);
    if (!shown.length) return null;
    return <ul className="pp-waiting" aria-label={copy('Suggested assistants', 'შეთავაზებული ასისტენტები')}>{shown.map(s => <li key={s.id} className="pp-waiting__row">
        <span className="cw-dot cw-dot--warning" aria-hidden="true" />
        <span className="pp-waiting__text">
            <strong>{s.name}</strong>
            <span className="gk-muted">{jobName('ASSISTANT_COACH')} · {s.squads.map(q => q.name).join(', ')}</span>
            <small className="gk-faint">{s.suggestedById === me ? copy(`You suggested · ${relativeTime(s.createdAt)}`, `თქვენ შესთავაზეთ · ${relativeTime(s.createdAt)}`)
                : copy(`Suggested by ${s.suggestedByName} · ${relativeTime(s.createdAt)}`, `შესთავაზა ${s.suggestedByName} · ${relativeTime(s.createdAt)}`)}</small>
        </span>
        <span className="cw-status cw-status--warning">{admin ? copy('Decide', 'გადაწყვიტეთ') : copy('Waiting for an admin', 'ადმინს ელოდება')}</span>
        <span className="gk-row pp-waiting__actions">{admin ? <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => onDecide(s, 'confirm')}>{copy('Confirm', 'დადასტურება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(s, 'decline')}>{copy('Decline', 'უარყოფა')}</Button>
        </> : <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(s, 'withdraw')}>{copy('Withdraw', 'გაუქმება')}</Button>}</span>
    </li>)}</ul>;
}
