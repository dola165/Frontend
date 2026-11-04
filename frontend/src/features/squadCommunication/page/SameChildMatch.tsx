import { useState } from 'react';
import { Button } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { sameChild, type SquadSameChild } from '../api';
import { useJourneyCopy } from '../journeyCopy';
import './squad-page.css';

/**
 * A join request that looks like a card the club made (family linking plan, "Same child · New player"), wherever the
 * coach answers requests: Same child makes the two one card, the club's, and the asker its parent, so the coach ticks
 * that they know that (S7; unsure, the card goes to its family from Players). New player sets the match aside on this
 * screen only (nothing is stored). With a family already on that card, a quiet note: their parent was asked.
 */
export function SameChildMatch({ squadId, requestPlayerId, childName, askedBy, match, className, failedText, onApart, onAnswered, onSaving }: {
    squadId: number; requestPlayerId: number; childName: string; askedBy?: string | null; match: SquadSameChild; className?: string; failedText: string;
    onApart: () => void; onAnswered: (notice: { tone: 'success' | 'danger'; text: string }) => void;
    /** While Same child saves, the row's other answers wait. */ onSaving?: (saving: boolean) => void;
}) {
    const say = useJourneyCopy();
    const [busy, setBusy] = useState(false), [asking, setAsking] = useState(false), [known, setKnown] = useState(false);
    if (match.hasFamily) return <span className={`sp-match sp-match--quiet ${className ?? ''}`}>{say(`Looks like ${match.name}: their parent was asked.`, `ჰგავს ${match.name}-ს: მის მშობელს ვკითხეთ.`)}</span>;
    const join = async () => {
        setBusy(true); onSaving?.(true);
        try {
            const done = await sameChild(squadId, requestPlayerId, match.playerId);
            onAnswered({ tone: 'success', text: done.status === 'DONE' ? say(`${childName} is now one card, the one you made.`, `${childName} ახლა ერთი ბარათია, თქვენ მიერ შექმნილი.`) : say(`We asked ${childName}’s family to confirm.`, `${childName}-ის ოჯახს დადასტურება ვთხოვეთ.`) });
        } catch (error) { onAnswered({ tone: 'danger', text: extractApiErrorMessage(error, failedText) }); }
        finally { setBusy(false); onSaving?.(false); }
    };
    if (asking) return <span className={`sp-match ${className ?? ''}`}>
        <label className="gk-row"><input type="checkbox" checked={known} disabled={busy} onChange={event => setKnown(event.target.checked)} /><span>{askedBy ? say(`I know ${askedBy} is ${match.name}’s parent`, `ვიცი, რომ ${askedBy} არის ${match.name}-ის მშობელი`) : say(`I know who asked is ${match.name}’s parent`, `ვიცი, რომ მომთხოვნი ${match.name}-ის მშობელია`)}</span></label>
        <small className="gk-faint">{say('Not sure? Send the card to its family from Players.', 'არ ხართ დარწმუნებული? ბარათი ოჯახს გაუგზავნეთ მოთამაშეების გვერდიდან.')}</small>
        <Button size="sm" variant="primary" disabled={busy || !known} onClick={() => void join()}>{say('Make them one card', 'ერთ ბარათად გაერთიანება')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(false)}>{say('Back', 'უკან')}</Button></span>;
    return <span className={`sp-match ${className ?? ''}`}><Status tone="warning">{say(`Looks like ${match.name}, a card you made`, `ჰგავს ${match.name}-ს, თქვენ მიერ შექმნილ ბარათს`)}</Status>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => setAsking(true)}>{say('Same child', 'იგივე ბავშვია')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onApart}>{say('New player', 'ახალი მოთამაშეა')}</Button></span>;
}
