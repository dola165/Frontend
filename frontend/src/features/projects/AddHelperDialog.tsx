import { useId, useRef, useState, type FormEvent } from 'react';
import { Button, Field } from '../../design/primitives';
import { Dialog } from '../../design/Dialog';
import { extractApiErrorMessage } from '../../utils/apiError';
import { InviteLinkBox } from '../clubOperations/people/InviteLinkBox';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { addHelper, type HelperAdded, type ProjectDetail } from './api';

/**
 * A parent or volunteer on this project (phase B2): by name and email, at once, as a squad's session helpers are added.
 * They see this project alone, on Home and in their Inbox. Someone new gets a one-time link to send by email or
 * WhatsApp; adults only.
 */
export function AddHelperDialog({ project, onClose, onAdded }: { project: ProjectDetail; onClose: () => void; onAdded: (next: ProjectDetail) => void }) {
    const copy = useJourneyCopy();
    const id = useId();
    const requestId = useRef(crypto.randomUUID());
    const [name, setName] = useState(''), [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [added, setAdded] = useState<HelperAdded | null>(null);
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try { const answer = await addHelper(project.club!.id, project.summary.id, { name: name.trim(), email: email.trim(), requestId: requestId.current }); setAdded(answer); onAdded(answer.project); }
        catch (failure) { setError(extractApiErrorMessage(failure, copy('They couldn’t be added. Try again.', 'ვერ დაემატა. სცადეთ თავიდან.'))); }
        finally { setBusy(false); }
    };
    if (added) return <Dialog open size="md" title={copy(`${added.name} was added`, `${added.name} დაემატა`)} onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>{copy('Done', 'მზადაა')}</Button>}>
        {added.link
            ? <InviteLinkBox name={added.name} link={{ token: added.link, expiresAt: added.linkExpiresAt ?? new Date().toISOString() }}
                message={copy(`You're helping with “${project.summary.goal}” at ${project.club?.name ?? 'the club'}. Open this link to see it:`, `თქვენ ეხმარებით „${project.summary.goal}“-ს, ${project.club?.name ?? 'კლუბში'}. გახსენით ბმული:`)} />
            // Every existing address gets the same answer: they wait here by this name until they accept.
            : <p className="pj-quiet">{copy(`${added.name} waits here until they accept on Home. Then you can give them steps.`, `${added.name} აქ ელოდება, სანამ მთავარ გვერდზე არ დაეთანხმება. შემდეგ შეძლებთ ნაბიჯების მიცემას.`)}</p>}
    </Dialog>;
    return <Dialog open size="md" title={copy('Add a parent or volunteer', 'მშობლის ან მოხალისის დამატება')} description={project.summary.goal} onClose={onClose}
        footer={<><Button onClick={onClose}>{copy('Cancel', 'გაუქმება')}</Button><Button variant="primary" type="submit" form={id} disabled={busy}>{copy('Add', 'დამატება')}</Button></>}>
        <form id={id} className="gk-stack" onSubmit={event => void submit(event)}>
            <Field label={copy('Name', 'სახელი')} htmlFor={`${id}-name`}><input id={`${id}-name`} className="gk-input" required maxLength={120} autoComplete="off" value={name} onChange={event => setName(event.target.value)} /></Field>
            <Field label={copy('Email', 'ელფოსტა')} htmlFor={`${id}-email`}><input id={`${id}-email`} className="gk-input" type="email" required maxLength={254} autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} /></Field>
            <p className="pj-quiet">{copy('They see this project only: its steps, photos and talk. Adults only.', 'ხედავენ მხოლოდ ამ პროექტს: ნაბიჯებს, ფოტოებს და საუბარს. მხოლოდ სრულწლოვნები.')}</p>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </form>
    </Dialog>;
}
