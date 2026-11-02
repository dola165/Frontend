import { useState } from 'react';
import { Button } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { sameChild, type SquadSameChild } from '../api';
import { useJourneyCopy } from '../journeyCopy';
import './squad-page.css';

/**
 * A join request that looks like a card the club made (family linking plan, "Same child · New player"), wherever the
 * coach answers requests: Same child makes the two one card, the club's; New player sets the match aside on this screen
 * only (nothing is stored). With a family already on that card, a quiet note: their parent was asked.
 */
export function SameChildMatch({ squadId, requestPlayerId, childName, match, className, failedText, onApart, onAnswered, onSaving }: {
    squadId: number; requestPlayerId: number; childName: string; match: SquadSameChild; className?: string; failedText: string;
    onApart: () => void; onAnswered: (notice: { tone: 'success' | 'danger'; text: string }) => void;
    /** While Same child saves, the row's other answers wait. */ onSaving?: (saving: boolean) => void;
}) {
    const say = useJourneyCopy();
    const [busy, setBusy] = useState(false);
    if (match.hasFamily) return <span className={`sp-match sp-match--quiet ${className ?? ''}`}>{say(`Looks like ${match.name}: their parent was asked.`, `ჰგავს ${match.name}-ს: მის მშობელს ვკითხეთ.`)}</span>;
    const join = async () => {
        setBusy(true); onSaving?.(true);
        try {
            const done = await sameChild(squadId, requestPlayerId, match.playerId);
            onAnswered({ tone: 'success', text: done.status === 'DONE' ? say(`${childName} is now one card, the one you made.`, `${childName} ახლა ერთი ბარათია, თქვენ მიერ შექმნილი.`) : say(`We asked ${childName}’s family to confirm.`, `${childName}-ის ოჯახს დადასტურება ვთხოვეთ.`) });
        } catch (error) { onAnswered({ tone: 'danger', text: extractApiErrorMessage(error, failedText) }); }
        finally { setBusy(false); onSaving?.(false); }
    };
    return <span className={`sp-match ${className ?? ''}`}><Status tone="warning">{say(`Looks like ${match.name}, a card you made`, `ჰგავს ${match.name}-ს, თქვენ მიერ შექმნილ ბარათს`)}</Status>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void join()}>{say('Same child', 'იგივე ბავშვია')}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onApart}>{say('New player', 'ახალი მოთამაშეა')}</Button></span>;
}
