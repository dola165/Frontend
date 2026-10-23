import { useId, useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { invitePerson, type InviteResult, type JobDraft, type Person, type PeopleView } from './api';
import { JobPicker } from './JobPicker';
import { useJobWords } from './jobWords';

const blank = (headCoach: boolean): JobDraft => ({ job: headCoach ? 'ASSISTANT_COACH' : 'HEAD_COACH', title: '', tools: [], clubWide: false, squadIds: [] });

/**
 * The one short invite form: name, email, job, where. For someone already listed (`person`), only the job and where.
 * Someone without an account gets one and the inviter a one-time link; someone with an account is invited in the app.
 */
export function InviteDialog({ open, club, view, person, onClose, onInvited }: {
    open: boolean; club: number; view: PeopleView; person?: Person; onClose: () => void; onInvited: (result: InviteResult) => void;
}) {
    const id = useId();
    const { copy } = useJobWords();
    const headCoach = !view.viewer.leader;
    const [name, setName] = useState(''), [email, setEmail] = useState(''), [draft, setDraft] = useState<JobDraft>(() => blank(headCoach));
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const close = () => { if (busy) return; setName(''); setEmail(''); setDraft(blank(headCoach)); setError(''); onClose(); };
    const problem = !person && name.trim().length < 2 ? copy('Enter their name.', 'შეიყვანეთ სახელი.')
        : !person && !/^\S+@\S+\.\S+$/.test(email.trim()) ? copy('Enter their email.', 'შეიყვანეთ ელფოსტა.')
            : draft.job === 'CUSTOM' && (!draft.title.trim() || !draft.tools.length) ? copy('Name the custom job and tick at least one tool.', 'დაარქვით სამუშაოს სახელი და მონიშნეთ ერთი ხელსაწყო მაინც.')
                : draft.job !== 'ADMIN' && !draft.clubWide && !draft.squadIds.length ? copy('Choose where the job applies.', 'აირჩიეთ, სად ვრცელდება სამუშაო.') : '';
    const submit = async () => {
        if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        try {
            const result = await invitePerson(club, person ? { userId: person.userId } : { name: name.trim(), email: email.trim() }, draft);
            setBusy(false); setName(''); setEmail(''); setDraft(blank(headCoach));
            onInvited(result);
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The invite couldn’t be sent.', 'მოწვევა ვერ გაიგზავნა.'))); setBusy(false); }
    };
    return <Dialog open={open} size="md" onClose={close} title={person ? copy(`Give ${person.name} a job`, `${person.name}: ახალი სამუშაო`) : copy('Invite someone', 'მოწვევა')}
        description={person ? undefined : copy('They get a link to choose their own password, or an invite in the app if they already have an account.', 'მიიღებს ბმულს საკუთარი პაროლის ასარჩევად, ან მოწვევას აპში, თუ ანგარიში უკვე აქვს.')}
        footer={<><Button variant="ghost" disabled={busy} onClick={close}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? copy('Inviting…', 'იგზავნება…') : copy('Invite', 'მოწვევა')}</Button></>}>
        <form className="pp-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            {!person && <div className="pp-form__who">
                <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
                <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
            </div>}
            <JobPicker view={view} draft={draft} onChange={setDraft} headCoachOnly={headCoach} allowAdmin={view.viewer.owner} disabled={busy} />
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <button type="submit" hidden />
        </form>
    </Dialog>;
}
