import { MailCheck } from 'lucide-react';
import { EmailWait } from '../../components/auth/EmailWait';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import './email-notice-line.css';

/**
 * Whether news can reach this person's email (step 2, M7): a confirmed address says so; one not yet confirmed says
 * what that costs, with Resend. Nothing when there is no address or email is unsubscribed (the settings say that).
 */
export function EmailNoticeLine({ email, verified, unsubscribed = false }: { email: string | null; verified: boolean; unsubscribed?: boolean }) {
    const copy = useJourneyCopy();
    if (!email || unsubscribed) return null;
    if (verified) return <p className="gk-email-notice-line" data-testid="email-notice-line">
        <MailCheck aria-hidden className="gk-email-notice-line__icon" />
        {copy(`News also reaches ${email}.`, `ამბები ასევე მოდის მისამართზე ${email}.`)}
    </p>;
    return <EmailWait
        title={copy(`Confirm ${email} to get news by email`, `დაადასტურეთ ${email}, რომ ამბები ელფოსტითაც მიიღოთ`)}
        hint={copy('Until then, news reaches you in the app and by push only.', 'მანამდე ამბები მხოლოდ აპში და push-ით მოგივათ.')}
        sentHint={copy('Sent. Open the link in the email.', 'გაიგზავნა. გახსენით ბმული წერილში.')} />;
}
