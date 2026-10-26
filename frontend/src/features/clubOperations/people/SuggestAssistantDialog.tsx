import { useId, useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { ScopeChips } from '../ScopeChips';
import { invitePerson, type PeopleSquad } from './api';
import { useJobWords } from './jobWords';

/**
 * A head coach suggests an assistant coach for a squad they lead: name and email, the squad already chosen when they
 * have one. The admins confirm or decline it from their notification; nothing starts until one of them does.
 */
export function SuggestAssistantDialog({ club, squads, onClose, onSent }: {
    club: number; squads: PeopleSquad[]; onClose: () => void; onSent: (notice: string) => void;
}) {
    const id = useId();
    const { copy } = useJobWords();
    const [name, setName] = useState(''), [email, setEmail] = useState('');
    const [squadIds, setSquadIds] = useState<number[]>(squads.length === 1 ? [squads[0].id] : []);
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const problem = name.trim().length < 2 ? copy('Enter their name.', 'შეიყვანეთ სახელი.')
        : !/^\S+@\S+\.\S+$/.test(email.trim()) ? copy('Enter their email.', 'შეიყვანეთ ელფოსტა.')
            : !squadIds.length ? copy('Choose the squad.', 'აირჩიეთ გუნდი.') : '';
    const submit = async () => {
        if (problem) { setError(problem); return; }
        setBusy(true); setError('');
        try {
            // From a head coach, an invite is a suggestion: it waits for an admin (status SUGGESTED, no link yet).
            await invitePerson(club, { name: name.trim(), email: email.trim() }, { job: 'ASSISTANT_COACH', title: '', tools: [], clubWide: false, squadIds });
            onSent(copy(`Suggested ${name.trim()}. An admin confirms or declines it; you’ll be told.`, `${name.trim()} შეთავაზებულია. ადმინი დაადასტურებს ან უარყოფს; შეგატყობინებთ.`));
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('The suggestion couldn’t be sent.', 'შეთავაზება ვერ გაიგზავნა.'))); setBusy(false); }
    };
    return <Dialog open size="md" onClose={() => { if (!busy) onClose(); }} title={copy('Suggest an assistant', 'ასისტენტის შეთავაზება')}
        description={squads.length === 1 ? copy(`Assistant coach for ${squads[0].name}. An admin confirms it.`, `მწვრთნელის ასისტენტი: ${squads[0].name}. ადმინი ადასტურებს.`)
            : copy('Assistant coach for your squad. An admin confirms it.', 'მწვრთნელის ასისტენტი თქვენი გუნდისთვის. ადმინი ადასტურებს.')}
        footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit()}>{busy ? copy('Sending…', 'იგზავნება…') : copy('Suggest', 'შეთავაზება')}</Button></>}>
        <form className="pp-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <div className="pp-form__who">
                <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" autoComplete="off" maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></Field>
                <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" autoComplete="off" maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
            </div>
            {squads.length > 1 && <ScopeChips squads={squads} allowClubWide={false} disabled={busy} legend={copy('Squad', 'გუნდი')}
                value={{ clubWide: false, squadIds }} onChange={scope => setSquadIds(scope.squadIds)} />}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <button type="submit" hidden />
        </form>
    </Dialog>;
}
