import { useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import './confirm-email.css';

/** Shown where an action that needs a confirmed email was refused (see emailConfirmation.ts): "Confirm your email first", with Resend beside it. */
export function ConfirmEmailFirst({ className = '' }: { className?: string }) {
    const copy = useJourneyCopy();
    const email = useAuth().user?.email;
    const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
    const resend = async () => {
        if (!email) return;
        setState('sending');
        try { await apiClient.post('/auth/resend-verification', { email }); setState('sent'); } catch { setState('failed'); }
    };
    return <div role="alert" className={`gk-confirm-email ${className}`.trim()}>
        <MailCheck aria-hidden="true" />
        <span className="gk-confirm-email__text">
            <strong>{copy('Confirm your email first', 'ჯერ დაადასტურეთ ელფოსტა')}</strong>
            <small>{state === 'sent' ? copy(`Sent to ${email}. Open the link, then try again.`, `გაიგზავნა: ${email}. გახსენით ბმული და სცადეთ ხელახლა.`)
                : state === 'failed' ? copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.')
                : copy(`The link is in ${email ?? 'your inbox'}.`, `ბმული ${email ?? 'თქვენს ელფოსტაშია'}.`)}</small>
        </span>
        {state !== 'sent' && <Button size="sm" variant="secondary" disabled={state === 'sending' || !email} onClick={() => void resend()}>
            {state === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}{copy('Resend', 'ხელახლა გაგზავნა')}
        </Button>}
    </div>;
}
