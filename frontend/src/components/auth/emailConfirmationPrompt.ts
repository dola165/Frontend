import { toast } from 'sonner';
import { appLanguage } from '../../utils/formatting';
import { confirmationJobTitle, needsConfirmedEmail, sendEmailConfirmation } from './emailConfirmation';

const say = (en: string, ka: string) => (appLanguage() === 'ka' ? ka : en);

/**
 * For a write the backend refused with EMAIL_CONFIRMATION_REQUIRED: one toast, right where it was pressed, saying
 * "Confirm your email first" (or which job waits on it) with Resend. Returns whether it was that refusal, so the
 * caller skips its own error. One toast at a time, however many writes were refused.
 */
export function promptEmailConfirmation(error: unknown): boolean {
    if (!needsConfirmedEmail(error)) return false;
    const job = confirmationJobTitle(error);
    toast.warning(job ? say(`Confirm your email to start as ${job}`, `დაადასტურეთ ელფოსტა და დაიწყეთ, როგორც ${job}`) : say('Confirm your email first', 'ჯერ დაადასტურეთ ელფოსტა'), {
        id: 'confirm-email',
        description: say('Open the link we sent, then try again.', 'გახსენით გამოგზავნილი ბმული და სცადეთ ხელახლა.'),
        action: { label: say('Resend', 'ხელახლა გაგზავნა'), onClick: () => {
            void sendEmailConfirmation().then(
                () => toast(say('Sent. Check your inbox.', 'გაიგზავნა. შეამოწმეთ ელფოსტა.'), { id: 'confirm-email-sent' }),
                () => toast.error(say('That did not send. Try again.', 'ვერ გაიგზავნა. სცადეთ ხელახლა.'), { id: 'confirm-email-sent' }));
        } },
    });
    return true;
}
