import { useEffect, useState } from 'react';
import { Crown, LifeBuoy } from 'lucide-react';
import { Button, Section } from '../../../design/primitives';
import { formatDate } from '../../../utils/formatting';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { refreshAccess } from '../../../hooks/useCan';
import { useAuth } from '../../../context/AuthContext';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { answerHandover, askHandover, cancelHandover, fetchOwnership, objectToReclaim, type Ownership } from './api';
import { useOtherClub } from './useOtherClub';
import './leaving.css';

/**
 * Who owns the club, when that is moving: a handover offered to this person (Take over or Decline), the Owner's own
 * handover waiting (Cancel), an Admin's request to GrassKickZ because the Owner vanished (the Owner can Object; it is
 * decided after 30 days), and, for Admins the rule-checker allows (`ask_handover`), "Ask GrassKickZ to hand it over".
 * Shows nothing when ownership is settled.
 */
export function OwnershipPanel({ clubId, clubName, canAsk, onChanged }: { clubId: number; clubName: string; canAsk: boolean; onChanged: (notice: string) => void }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const other = useOtherClub();
    const [state, setState] = useState<Ownership | null>(null), [round, setRound] = useState(0);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        fetchOwnership(clubId, controller.signal).then(found => { if (!controller.signal.aborted) setState(found); })
            .catch(() => { /* Ownership is shown only when known; People works without it. */ });
        return () => controller.abort();
    }, [clubId, round]);
    if (!state) return null;
    const me = user?.id, owner = state.ownerId === me;
    const run = async (work: () => Promise<string | void>, fallback: string, retry?: () => void) => {
        if (busy) return;
        setBusy(true); setError('');
        try { const notice = await work(); refreshAccess(); setRound(v => v + 1); if (notice) onChanged(notice); }
        catch (failure) { if (!(retry && other.catchOther(failure, retry))) setError(extractApiErrorMessage(failure, fallback)); }
        finally { setBusy(false); }
    };
    const day = (value: string) => formatDate(value, { day: 'numeric', month: 'short' });
    const waiting = (status: string) => ['PENDING', 'WAITING', 'OPEN', 'INVITED'].includes(status);
    const handover = state.handover && waiting(state.handover.status) ? state.handover : null;
    const reclaim = state.reclaim && (waiting(state.reclaim.status) || state.reclaim.status === 'OBJECTED') ? state.reclaim : null;
    const take = (accept: boolean) => {
        if (!handover) return;
        const act = () => void run(async () => {
            const answer = await answerHandover(clubId, handover.id, accept);
            return answer.outcome === 'TRANSFERRED' ? copy(`You own ${clubName} now.`, `${clubName} ახლა თქვენია.`) : copy('Declined. The Owner is told.', 'უარყოფილია. მფლობელს ეცნობა.');
        }, copy('Your answer wasn’t saved. Try again.', 'პასუხი ვერ შეინახა. სცადეთ ხელახლა.'), act);
        act();
    };
    const row = (text: string, sub: string | null, actions: React.ReactNode) => <div className="lv-owner">
        <span className="lv-owner__text"><strong>{text}</strong>{sub && <small>{sub}</small>}</span>
        <span className="gk-row">{actions}</span>
    </div>;

    const body = handover && handover.toUserId === me
        ? row(copy(`${state.ownerName} wants to hand ${clubName} to you.`, `${state.ownerName} გთავაზობთ ${clubName}-ის ჩაბარებას.`), copy('You become its Owner.', 'გახდებით მისი მფლობელი.'), <>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => take(true)}><Crown aria-hidden="true" />{copy('Take over', 'ჩაბარება')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => take(false)}>{copy('Decline', 'უარყოფა')}</Button></>)
        : handover && owner
            ? row(copy(`Waiting for ${handover.toName} to take ${clubName} over.`, `ველოდებით, როდის ჩაიბარებს ${handover.toName} ${clubName}-ს.`), copy(`Asked ${day(handover.createdAt)}.`, `შეთავაზდა ${day(handover.createdAt)}.`),
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await cancelHandover(clubId, handover.id); return copy('Handover cancelled.', 'გადაცემა გაუქმდა.'); }, copy('It couldn’t be cancelled.', 'ვერ გაუქმდა.'))}>{copy('Cancel', 'გაუქმება')}</Button>)
            : reclaim && owner
                ? row(copy(`${reclaim.byName} asked GrassKickZ to hand ${clubName} over.`, `${reclaim.byName}-მა GrassKickZ-ს სთხოვა ${clubName}-ის გადაცემა.`),
                    copy(`It happens on ${day(reclaim.dueAt)} unless you object.`, `${day(reclaim.dueAt)}-ს მოხდება, თუ არ შეეწინააღმდეგებით.`),
                    <Button size="sm" variant="primary" disabled={busy || Boolean(reclaim.objectedAt)} onClick={() => void run(async () => { await objectToReclaim(clubId, reclaim.id); return copy('Objection sent. You stay the Owner.', 'პროტესტი გაიგზავნა. მფლობელად რჩებით.'); }, copy('It couldn’t be sent.', 'ვერ გაიგზავნა.'))}>{copy('I’m still here', 'აქ ვარ')}</Button>)
                : reclaim
                    ? row(copy(`GrassKickZ was asked to hand ${clubName} over.`, `GrassKickZ-ს ეთხოვა ${clubName}-ის გადაცემა.`),
                        reclaim.objectedAt ? copy(`${state.ownerName} objected, so they stay the Owner.`, `${state.ownerName} შეეწინააღმდეგა, ამიტომ მფლობელად რჩება.`)
                            : copy(`Asked by ${reclaim.byName}. Decided on ${day(reclaim.dueAt)} unless ${state.ownerName} objects.`, `სთხოვა ${reclaim.byName}-მა. გადაწყდება ${day(reclaim.dueAt)}-ს, თუ ${state.ownerName} არ შეეწინააღმდეგება.`), null)
                    : canAsk && !owner
                        ? row(copy(`${state.ownerName} owns ${clubName}.`, `${clubName} ${state.ownerName}-ს ეკუთვნის.`), copy('If the Owner has gone and doesn’t answer, GrassKickZ can hand the club to an Admin.', 'თუ მფლობელი აღარ ჩანს და არ პასუხობს, GrassKickZ-ს შეუძლია კლუბი ადმინს გადასცეს.'),
                            <Button size="sm" disabled={busy} onClick={() => void run(async () => { const asked = await askHandover(clubId); return copy(`Asked. ${state.ownerName} is told and can object until ${day(asked.dueAt)}.`, `გაიგზავნა. ${state.ownerName}-ს ეცნობა და ${day(asked.dueAt)}-მდე შეუძლია შეეწინააღმდეგოს.`); }, copy('It couldn’t be asked. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.'))}>
                                <LifeBuoy aria-hidden="true" />{copy('Ask GrassKickZ to hand it over', 'GrassKickZ-ისთვის გადაცემის თხოვნა')}</Button>)
                        : null;
    if (!body) return null;
    return <Section boxed title={copy('Ownership', 'მფლობელობა')}>
        <div className="gk-stack">
            {body}
            {other.notice}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Section>;
}
