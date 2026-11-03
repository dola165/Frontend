import { useState } from 'react';
import { MailCheck, MailWarning } from 'lucide-react';
import { sendEmailConfirmation } from '../../components/auth/emailConfirmation';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './email-notice-line.css';

/**
 * Whether news can reach this person's email (step 2, M7): a confirmed address says so; one not yet confirmed says
 * what that costs, with Resend. Nothing when there is no address or email is unsubscribed (the settings say that).
 * Self-contained, so it reads the same in Account, on Home and in the work screens.
 */
export function EmailNoticeLine({ email, verified, unsubscribed = false }: { email: string | null; verified: boolean; unsubscribed?: boolean }) {
    const copy = useJourneyCopy();
    const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
    if (!email || unsubscribed) return null;
    if (verified) return <p className="gk-email-notice-line" data-testid="email-notice-line">
        <MailCheck aria-hidden className="gk-email-notice-line__icon" />
        <span>{copy(`News also reaches ${email}.`, `ამბები ასევე მოდის მისამართზე ${email}.`)}</span>
    </p>;
    const resend = () => { setSent('sending'); sendEmailConfirmation().then(() => setSent('sent'), () => setSent('failed')); };
    return <div className="gk-email-notice-line gk-email-notice-line--waiting" role="status" data-testid="email-notice-line">
        <MailWarning aria-hidden className="gk-email-notice-line__icon" />
        <span className="gk-email-notice-line__words">
            <strong>{copy(`Confirm ${email} to get news by email`, `დაადასტურეთ ${email}, რომ ამბები ელფოსტითაც მიიღოთ`)}</strong>
            <small>{sent === 'sent' ? copy('Sent. Open the link in the email.', 'გაიგზავნა. გახსენით ბმული წერილში.')
                : sent === 'failed' ? copy('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.')
                    : copy('Until then, news reaches you in the app and by push only.', 'მანამდე ამბები მხოლოდ აპში და push-ით მოგივათ.')}</small>
        </span>
        {sent !== 'sent' && <button type="button" className="gk-email-notice-line__resend" disabled={sent === 'sending'} onClick={resend}>{copy('Resend', 'ხელახლა გაგზავნა')}</button>}
    </div>;
}
