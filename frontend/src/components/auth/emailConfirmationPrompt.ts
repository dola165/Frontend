import { toast } from 'sonner';
import { appLanguage } from '../../utils/formatting';
import { confirmationFor, confirmationJobTitle, needsConfirmedEmail, sendEmailConfirmation } from './emailConfirmation';

const say = (en: string, ka: string) => (appLanguage() === 'ka' ? ka : en);

/** "Confirm your email to publish": what was pressed, from the server's `confirmFor`; the job by name when known. */
function title(error: unknown) {
    const job = confirmationFor(error) === 'HELP' ? null : confirmationJobTitle(error);
    if (job) return say(`Confirm your email to start as ${job}`, `დაადასტურეთ ელფოსტა და დაიწყეთ, როგორც ${job}`);
    switch (confirmationFor(error)) {
        case 'INVITE': return say('Confirm your email to invite people', 'მოსაწვევად ჯერ დაადასტურეთ ელფოსტა');
        case 'PUBLISH': return say('Confirm your email to publish', 'გამოსაქვეყნებლად ჯერ დაადასტურეთ ელფოსტა');
        case 'MONEY': return say('Confirm your email to take payments', 'გადახდების მისაღებად ჯერ დაადასტურეთ ელფოსტა');
        case 'JOB': return say('Confirm your email to start this job', 'ამ სამუშაოს დასაწყებად ჯერ დაადასტურეთ ელფოსტა');
        case 'HELP': return say('Confirm your email to see what you were added to', 'დაადასტურეთ ელფოსტა, რომ ნახოთ, სად დაგამატეს');
        default: return say('Confirm your email first', 'ჯერ დაადასტურეთ ელფოსტა');
    }
}

/**
 * For a write the backend refused with EMAIL_CONFIRMATION_REQUIRED: one toast, right where it was pressed, saying
 * "Confirm your email first" (or which job waits on it) with Resend. Returns whether it was that refusal, so the
 * caller skips its own error. One toast at a time, however many writes were refused.
 */
export function promptEmailConfirmation(error: unknown): boolean {
    if (!needsConfirmedEmail(error)) return false;
    toast.warning(title(error), {
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
