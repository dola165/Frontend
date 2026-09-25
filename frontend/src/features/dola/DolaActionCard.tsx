import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowUpRight } from 'lucide-react';
import { safeDolaDestination, type DolaAction } from './api';
import { useDola } from './DolaContext';

export function DolaActionCard({ action, ka }: { action: DolaAction; ka: boolean }) {
    const { busy, resolveAction, keepOpen, setDraft } = useDola();
    const [elapsed, setElapsed] = useState(() => !Number.isFinite(Date.parse(action.expiresAt)) || Date.parse(action.expiresAt) <= Date.now());
    useEffect(() => {
        const delay = Date.parse(action.expiresAt) - Date.now();
        const timer = setTimeout(() => setElapsed(true), Math.max(0, delay));
        return () => clearTimeout(timer);
    }, [action.expiresAt]);
    const expired = elapsed;
    const pending = action.state === 'PENDING' && !expired;
    const complete = action.state === 'COMPLETED';
    const labels: Record<DolaAction['kind'], string> = ka ? {
        VENUE_BOOKING: 'ჯავშნის ან დახურვის შენახვა', VENUE_DECISION: 'ჯავშნის გადაწყვეტილების დადასტურება',
        COACH_UPDATE: 'განახლების გამოქვეყნება', CANCEL_SESSION: 'ვარჯიშის გაუქმება და გუნდის შეტყობინება',
        ACKNOWLEDGE_UPDATE: 'განახლების დადასტურება', SESSION_RESPONSE: 'პასუხის შენახვა', OPEN_CHALLENGE: 'ღია გამოწვევის გამოქვეყნება',
        REFEREE_DECISION: 'სამსაჯო გადაწყვეტილების დადასტურება', REFEREE_AVAILABILITY: 'ხელმისაწვდომობის ცვლილების დადასტურება', MATCH_PROPOSAL: 'მატჩის შეთავაზების გაგზავნა', MATCH_PROPOSAL_DECISION: 'მატჩის გადაწყვეტილების დადასტურება',
    } : { VENUE_BOOKING: 'Save booking or closure', VENUE_DECISION: 'Confirm booking decision', COACH_UPDATE: 'Publish coach update', CANCEL_SESSION: 'Cancel session and notify squad', ACKNOWLEDGE_UPDATE: 'Acknowledge update', SESSION_RESPONSE: 'Save training response', OPEN_CHALLENGE: 'Publish open challenge',
        REFEREE_DECISION: 'Confirm referee decision', REFEREE_AVAILABILITY: 'Confirm availability change', MATCH_PROPOSAL: 'Send match proposal', MATCH_PROPOSAL_DECISION: 'Confirm match decision' };
    // A malformed provider/backend payload must never turn into an arbitrary executable action.
    if (!Object.hasOwn(labels, action.kind) || !/^[0-9a-f-]{36}$/i.test(action.id)) return null;
    return <section className={`dola-action ${complete ? 'dola-action--complete' : ''}`} aria-label={ka ? 'მოქმედების გადახედვა' : 'Review action'}>
        <div className="dola-action-status">{complete ? <><Check size={15} />{ka ? 'შესრულებულია' : 'Completed'}</> : pending ? (ka ? 'შეამოწმეთ დადასტურებამდე' : 'Review before confirming') : action.state === 'SUPERSEDED' ? (ka ? 'შეცვლილია ახალი ვერსიით' : 'Replaced by a newer review') : action.state === 'DISCARDED' ? (ka ? 'გაუქმებულია' : 'Discarded') : (ka ? 'ვადა ამოიწურა' : 'Review expired')}</div>
        <h3>{action.title}</h3>
        {action.kind !== 'SESSION_RESPONSE' && <p className="dola-action-body">{action.body}</p>}
        <dl>{action.details.map((detail, index) => <div key={index} className={detail.value.includes(" — Suggested") ? "dola-action-suggestion" : undefined}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
        {complete && <p className="dola-action-receipt" role="status">{action.receipt}</p>}
        {pending && <>{action.kind === 'OPEN_CHALLENGE' && action.details.some(detail => detail.value.includes(' — Suggested')) && <p className="dola-action-note">{ka ? 'დადასტურებით ეთანხმებით შემოთავაზებულ დეტალებსაც. ცვლილებისთვის აირჩიეთ „დეტალების შეცვლა“.' : 'Confirming also approves the suggested choices shown above. Use Edit details to change any of them.'}</p>}<p className="dola-action-note">{ka ? 'ჯერ არაფერი შეცვლილა. დადასტურება ხელმისაწვდომია 10 წუთის განმავლობაში.' : 'Nothing has changed yet. This review is valid for 10 minutes.'}</p>
            <div className="dola-action-buttons"><button type="button" className="dola-action-confirm" disabled={busy} onClick={() => void resolveAction(action, 'confirm')}>{!ka && ['REFEREE_DECISION', 'REFEREE_AVAILABILITY', 'MATCH_PROPOSAL_DECISION', 'VENUE_BOOKING', 'VENUE_DECISION'].includes(action.kind) && action.confirmLabel ? action.confirmLabel : labels[action.kind]}</button>
                {(action.kind === 'COACH_UPDATE' || action.kind === 'OPEN_CHALLENGE' || action.kind === 'VENUE_BOOKING') && <button type="button" disabled={busy} onClick={() => { setDraft(ka ? 'შეცვალე ეს მონახაზი: ' : 'Revise this draft: '); document.getElementById('dola-message')?.focus(); }}>{action.kind !== 'COACH_UPDATE' ? (ka ? 'დეტალების შეცვლა' : 'Edit details') : (ka ? 'ტექსტის შეცვლა' : 'Revise wording')}</button>}
                <button type="button" disabled={busy} onClick={() => void resolveAction(action, 'discard')}>{ka ? 'გაუქმება' : 'Discard'}</button></div></>}
        {complete && action.destination && safeDolaDestination(action.destination) && <Link className="dola-destination" to={action.destination.path} onClick={keepOpen}>{action.kind === 'OPEN_CHALLENGE' ? (ka ? 'გამოწვევის ნახვა' : 'View open challenge') : (ka ? 'სამუშაო სივრცეში ნახვა' : 'View in workspace')}<ArrowUpRight size={16} /></Link>}
    </section>;
}
