import { useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { Button } from '../../../design/primitives';
import { extractApiErrorCode, extractApiErrorMessage } from '../../../utils/apiError';
import { ageFromDob } from '../../../utils/age';
import { isEmail } from '../../../utils/registration';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { giveOwnAccount, type JoiningChild, type OwnAccount as OwnAccountState } from '../api';
import { relativeTime } from '../../../utils/relativeTime';

/**
 * "Give Luka their own account" on the child's card (release 7), from the server's `ownAccount`: NONE offers it (the
 * child's email), INVITED says where and when the link went with Send again and Use another email, ACTIVE says the
 * child has their own account, NOT_ELIGIBLE shows nothing. Without `ownAccount` (an older server) a child of 13+ is offered it.
 */
export function OwnAccount({ child, onChanged }: { child: JoiningChild; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const first = child.identity.fullName.split(' ')[0];
    const age = ageFromDob(child.identity.dateOfBirth);
    const known = child.ownAccount;
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState<Pick<OwnAccountState, 'email' | 'sentAt'> | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const status = sent ? 'INVITED' : known?.status ?? (age != null && age >= 13 ? 'NONE' : 'NOT_ELIGIBLE');
    const address = sent?.email ?? known?.email ?? null;
    const sentAt = sent ? sent.sentAt : known?.sentAt;
    if (status === 'NOT_ELIGIBLE') return null;
    if (status === 'ACTIVE') return <p className="ph-own ph-own--done"><BadgeCheck aria-hidden="true" />{copy(`${first} has their own account.`, `${first} საკუთარი ანგარიშით სარგებლობს.`)}</p>;

    const send = async (to: string) => {
        if (busy) return;
        setBusy(true); setError('');
        try { const reply = await giveOwnAccount(child.playerId, to); setSent({ email: reply?.email ?? to, sentAt: reply?.sentAt ?? new Date().toISOString() }); setOpen(false); onChanged(); }
        catch (failure) {
            if (promptEmailConfirmation(failure)) return;
            setError(extractApiErrorCode(failure) === 'EMAIL_IN_USE'
                ? copy('That email already has an account. Use your child’s own email.', 'ამ ელფოსტით ანგარიში უკვე არსებობს. მიუთითეთ შვილის საკუთარი ელფოსტა.')
                : extractApiErrorMessage(failure, copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.')));
        } finally { setBusy(false); }
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const typed = email.trim().toLowerCase();
        if (!isEmail(typed)) { setError(copy('Enter your child’s email.', 'შეიყვანეთ შვილის ელფოსტა.')); return; }
        void send(typed);
    };
    const spinner = <Loader2 className="ph-own__spin" aria-hidden="true" />;

    if (status === 'INVITED' && address && !open) return <div className="ph-own" role="status">
        <span className="ph-row__icon" aria-hidden="true"><MailCheck /></span>
        <span className="ph-own__text"><span><strong>{copy(`Link sent to ${address}`, `ბმული გაიგზავნა: ${address}`)}</strong>{sentAt && <span className="ph-own__when"> · {relativeTime(sentAt)}</span>}</span>
            <small>{copy(`When ${first} sets a password, they sign in on their own. You stay their parent.`, `როცა ${first} პაროლს შექმნის, თავად შევა. თქვენ მისი მშობელი რჩებით.`)}</small></span>
        <span className="ph-own__actions">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send(address)}>{busy && spinner}{copy('Send again', 'ხელახლა გაგზავნა')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setOpen(true); setEmail(''); setError(''); }}>{copy('Use another email', 'სხვა ელფოსტა')}</Button>
        </span>
        {error && <p className="ph-own__error" role="alert">{error}</p>}
    </div>;
    if (!open) return <button type="button" className="ph-row ph-row--boxed ph-own__start" onClick={() => setOpen(true)}>
        <span className="ph-row__icon" aria-hidden="true"><KeyRound /></span>
        <span className="ph-row__text"><strong>{copy(`Give ${first} their own account`, `${first}: საკუთარი ანგარიში`)}</strong>
            <small>{copy('Their own sign-in, their history kept. You stay their parent.', 'საკუთარი შესვლა, ისტორია შენარჩუნდება. თქვენ მშობლად რჩებით.')}</small></span>
        <ArrowRight aria-hidden="true" />
    </button>;
    return <form className="ph-own ph-own--form" onSubmit={submit} noValidate>
        <label className="ph-own__label" htmlFor={`own-${child.playerId}`}>{copy(`${first}’s email`, 'შვილის ელფოსტა')}</label>
        <input id={`own-${child.playerId}`} className="gk-input" type="email" autoComplete="off" value={email} onChange={event => { setEmail(event.target.value); setError(''); }} aria-invalid={Boolean(error)} />
        <span className="ph-own__actions">
            <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setError(''); }}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy && spinner}{copy('Send the link', 'ბმულის გაგზავნა')}</Button>
        </span>
        {error && <p className="ph-own__error" role="alert">{error}</p>}
    </form>;
}
