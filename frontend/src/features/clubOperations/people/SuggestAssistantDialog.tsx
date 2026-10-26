import { useId, useState } from 'react';
import { Button, Chip, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ConfirmEmailFirst } from '../../../components/auth/ConfirmEmailFirst';
import { needsConfirmedEmail } from '../../../components/auth/emailConfirmation';
import { ScopeChips } from '../ScopeChips';
import { HELPER_JOBS, invitePerson, type PeopleSquad } from './api';
import { useJobWords } from './jobWords';

/**
 * A head coach suggests a helper for a squad they lead: an assistant coach (chosen first) or a team manager, name and
 * email, the squad already chosen when they have one. The admins confirm or decline it from their notification;
 * nothing starts until one of them does.
 */
export function SuggestAssistantDialog({ club, squads, onClose, onSent }: {
    club: number; squads: PeopleSquad[]; onClose: () => void; onSent: (notice: string) => void;
}) {
    const id = useId();
    const { copy, jobName } = useJobWords();
    const [name, setName] = useState(''), [email, setEmail] = useState(''), [job, setJob] = useState<typeof HELPER_JOBS[number]>('ASSISTANT_COACH');
    const [squadIds, setSquadIds] = useState<number[]>(squads.length === 1 ? [squads[0].id] : []);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmEmail, setConfirmEmail] = useState(false);
    const problem = name.trim().length < 2 ? copy('Enter their name.', 'შეიყვანეთ სახელი.')
        : !/^\S+@\S+\.\S+$/.test(email.trim()) ? copy('Enter their email.', 'შეიყვანეთ ელფოსტა.')
            : !squadIds.length ? copy('Choose the squad.', 'აირჩიეთ გუნდი.') : '';
    const submit = async () => {
        if (problem) { setError(problem); return; }
        setBusy(true); setError(''); setConfirmEmail(false);
        try {
            // From a head coach, an invite is a suggestion: it waits for an admin (status SUGGESTED, no link yet).
            await invitePerson(club, { name: name.trim(), email: email.trim() }, { job, title: '', tools: [], clubWide: false, squadIds });
            onSent(copy(`Suggested ${name.trim()}. An admin confirms or declines it; you’ll be told.`, `${name.trim()} შეთავაზებულია. ადმინი დაადასტურებს ან უარყოფს; შეგატყობინებთ.`));
        } catch (failure) { if (needsConfirmedEmail(failure)) setConfirmEmail(true); else setError(extractApiErrorMessage(failure, copy('The suggestion couldn’t be sent.', 'შეთავაზება ვერ გაიგზავნა.'))); setBusy(false); }
    };
    return <Dialog open size="md" onClose={() => { if (!busy) onClose(); }} title={copy('Suggest an assistant', 'ასისტენტის შეთავაზება')}
        description={squads.length === 1 ? copy(`A helper for ${squads[0].name}. An admin confirms it.`, `დამხმარე გუნდისთვის ${squads[0].name}. ადმინი ადასტურებს.`)
            : copy('A helper for your squad. An admin confirms it.', 'დამხმარე თქვენი გუნდისთვის. ადმინი ადასტურებს.')}
        footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? copy('Sending…', 'იგზავნება…') : copy('Suggest', 'შეთავაზება')}</Button></>}>
        <form className="pp-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <div className="pp-form__who">
                <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
                <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
            </div>
            <fieldset className="pp-picker__jobs" disabled={busy}>
                <legend className="gk-field__label">{copy('Job', 'სამუშაო')}</legend>
                <div className="gk-chips" role="group" aria-label={copy('Job', 'სამუშაო')}>
                    {HELPER_JOBS.map(key => <Chip key={key} pressed={job === key} onClick={() => setJob(key)}>{jobName(key)}</Chip>)}
                </div>
            </fieldset>
            {squads.length > 1 && <ScopeChips squads={squads} allowClubWide={false} disabled={busy} legend={copy('Squad', 'გუნდი')}
                value={{ clubWide: false, squadIds }} onChange={scope => setSquadIds(scope.squadIds)} />}
            {confirmEmail && <ConfirmEmailFirst />}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <button type="submit" hidden />
        </form>
    </Dialog>;
}
