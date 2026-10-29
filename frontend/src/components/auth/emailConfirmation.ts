import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorCode } from '../../utils/apiError';

/**
 * The backend's refusal of an action that needs a confirmed email: 403 EMAIL_CONFIRMATION_REQUIRED, with `confirmFor`
 * INVITE, PUBLISH, MONEY, JOB (starting a job, with `jobTitle` when known) (fnd-signup-b) or HELP (seeing the project
 * or session a helper was added to, `jobTitle` the project when there is one); `action` may be the
 * rule-checker's own key (`invite_staff`), so only `confirmFor` and `jobTitle` shape the words. fnd-access-b's
 * rule-checker and staff links say EMAIL_CONFIRMATION_NEEDED, and the older EMAIL_NOT_VERIFIED is read the same way.
 * Sign-in and everything else work without it; `promptEmailConfirmation` answers it where it was pressed.
 */
export const needsConfirmedEmail = (error: unknown) => ['EMAIL_CONFIRMATION_REQUIRED', 'EMAIL_CONFIRMATION_NEEDED', 'EMAIL_NOT_VERIFIED'].includes(extractApiErrorCode(error) ?? '');

/** The job waiting on the confirmation ("Assistant coach"), or for HELP the project, when the server names it. */
export function confirmationJobTitle(error: unknown): string | null {
    const title = (error as { response?: { data?: { jobTitle?: unknown } } } | null)?.response?.data?.jobTitle;
    return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/** What waits on the email (`confirmFor`), when the server says. */
export function confirmationFor(error: unknown): 'INVITE' | 'PUBLISH' | 'MONEY' | 'JOB' | 'HELP' | null {
    const value = (error as { response?: { data?: { confirmFor?: unknown } } } | null)?.response?.data?.confirmFor;
    return value === 'INVITE' || value === 'PUBLISH' || value === 'MONEY' || value === 'JOB' || value === 'HELP' ? value : null;
}

/** Sends a new confirmation link to the signed-in person's own address; once confirmed, its link continues to `next`. */
export const sendEmailConfirmation = (next?: string) => next ? apiClient.post('/auth/send-verification', { continuationPath: next }) : apiClient.post('/auth/send-verification');
