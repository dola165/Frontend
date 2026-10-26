import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { confirmationJobTitle, sendEmailConfirmation } from './emailConfirmation';
import './confirm-email.css';

/** Shown where an action that needs a confirmed email was refused (see emailConfirmation.ts): "Confirm your email first", with Resend beside it. */
export function ConfirmEmailFirst({ error, className = '' }: { /** The refusal, so a job waiting on it can be named. */ error?: unknown; className?: string }) {
    const copy = useJourneyCopy();
    const email = useAuth().user?.email;
    const job = confirmationJobTitle(error);
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
    const resend = async () => {
        setState('sending');
        try { await sendEmailConfirmation(); setState('sent'); } catch { setState('failed'); }
    };
    return <div role="alert" className={`gk-confirm-email ${className}`.trim()}>
        <MailCheck aria-hidden="true" />
        <span className="gk-confirm-email__text">
            <strong>{job ? copy(`Confirm your email to start as ${job}`, `დაადასტურეთ ელფოსტა და დაიწყეთ, როგორც ${job}`) : copy('Confirm your email first', 'ჯერ დაადასტურეთ ელფოსტა')}</strong>
            <small>{state === 'sent' ? copy(`Sent to ${email}. Open the link, then try again.`, `გაიგზავნა: ${email}. გახსენით ბმული და სცადეთ ხელახლა.`)
                : state === 'failed' ? copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.')
                : copy(`The link is in ${email ?? 'your inbox'}.`, `ბმული ${email ?? 'თქვენს ელფოსტაშია'}.`)}</small>
        </span>
        {state !== 'sent' && <Button size="sm" variant="secondary" disabled={state === 'sending'} onClick={() => void resend()}>
            {state === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}{copy('Resend', 'ხელახლა გაგზავნა')}
        </Button>}
    </div>;
}
