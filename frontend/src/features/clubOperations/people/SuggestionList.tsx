import { Button } from '../../../design/primitives';
import type { Suggestion } from './api';
import { useJobWords } from './jobWords';

/**
 * Suggested assistants still waiting: admins Confirm or Decline right here (the same choice as in their notification;
 * the first answer counts), and the head coach who suggested someone can withdraw it.
 */
export function SuggestionList({ suggestions, me, admin, busy, onDecide }: {
    suggestions: Suggestion[]; me: number; admin: boolean; busy: boolean;
    onDecide: (suggestion: Suggestion, decision: 'confirm' | 'decline' | 'withdraw') => void;
}) {
    const { copy, jobLabel, whereLabel } = useJobWords();
    if (!suggestions.length) return null;
    return <ul className="pp-waiting" aria-label={copy('Suggested assistants', 'შეთავაზებული ასისტენტები')}>{suggestions.map(({ person, job }) => {
        const decides = job.canConfirm ?? admin, mine = job.suggestedById === me;
        return <li key={job.id} className="pp-waiting__row">
            <span className="cw-dot cw-dot--warning" aria-hidden="true" />
            <span className="pp-waiting__text">
                <strong>{person.name}</strong>
                <span className="gk-muted">{jobLabel(job)} · {whereLabel(job)}</span>
                <small className="gk-faint">{mine ? copy('You suggested', 'თქვენ შესთავაზეთ') : copy(`Suggested by ${job.suggestedByName ?? 'a head coach'}`, `შესთავაზა ${job.suggestedByName ?? 'მთავარმა მწვრთნელმა'}`)}</small>
            </span>
            <span className="cw-status cw-status--warning">{decides ? copy('Decide', 'გადაწყვიტეთ') : copy('Waiting for an admin', 'ადმინს ელოდება')}</span>
            <span className="gk-row pp-waiting__actions">{decides ? <>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => onDecide({ person, job }, 'confirm')}>{copy('Confirm', 'დადასტურება')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide({ person, job }, 'decline')}>{copy('Decline', 'უარყოფა')}</Button>
            </> : mine && job.canEnd !== false && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide({ person, job }, 'withdraw')}>{copy('Withdraw', 'გაუქმება')}</Button>}</span>
        </li>;
    })}</ul>;
}
