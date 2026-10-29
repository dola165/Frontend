import { useState } from 'react';
import { Button } from '../../design/primitives';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { sendEmailConfirmation } from './emailConfirmation';
import './email-wait.css';

/**
 * What waits on a new account's email, with Resend: "Confirm your email to start as Assistant coach", or for a helper
 * "Confirm your email to see New kit for U12". Claiming an invite link confirms nothing (it travels by WhatsApp), so
 * the email goes out on claim; Resend sends a new one whose link continues to `next`.
 */
export function EmailWait({ title, hint, sentHint, next }: { title: string; hint: string; sentHint: string; next?: string }) {
    const copy = useJourneyCopy();
    const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
    const resend = () => { setSent('sending'); sendEmailConfirmation(next).then(() => setSent('sent'), () => setSent('failed')); };
    return <div role="status" className="gk-notice gk-notice--warning email-wait">
        <span><strong>{title}</strong>
            <small>{sent === 'sent' ? sentHint : sent === 'failed' ? copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.') : hint}</small></span>
        {sent !== 'sent' && <Button size="sm" disabled={sent === 'sending'} onClick={resend}>{copy('Resend', 'ხელახლა გაგზავნა')}</Button>}
    </div>;
}

/**
 * The helper's version: "Confirm your email to see New kit for U12" (`what`, a project), "…to see your session"
 * (`session`), or "…to see what you were added to"; once confirmed, the email's link opens `next`.
 */
export function HelperEmailWait({ what, session = false, next }: { what: string | null; session?: boolean; next?: string }) {
    const copy = useJourneyCopy();
    return <EmailWait next={next}
        title={what ? copy(`Confirm your email to see ${what}`, `დაადასტურეთ ელფოსტა, რომ ნახოთ: ${what}`)
            : session ? copy('Confirm your email to see your session', 'დაადასტურეთ ელფოსტა, რომ ნახოთ თქვენი ვარჯიში')
                : copy('Confirm your email to see what you were added to', 'დაადასტურეთ ელფოსტა, რომ ნახოთ, სად დაგამატეს')}
        hint={copy('Open the link we sent to your email.', 'გახსენით ელფოსტაზე გამოგზავნილი ბმული.')}
        sentHint={copy('Sent. Open the link in your email.', 'გაიგზავნა. გახსენით ბმული ელფოსტაში.')} />;
}
