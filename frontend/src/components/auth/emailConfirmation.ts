import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorCode } from '../../utils/apiError';

/**
 * The backend's refusal of an action that needs a confirmed email: 403 EMAIL_CONFIRMATION_REQUIRED, with `action`
 * INVITE, PUBLISH, MONEY or JOB (starting a job, with `jobTitle` when known) (fnd-signup-b). The older
 * EMAIL_NOT_VERIFIED is read the same way. Sign-in and everything else work without it; show `ConfirmEmailFirst`
 * (or a toast with Resend) at the refused spot.
 */
export const needsConfirmedEmail = (error: unknown) => ['EMAIL_CONFIRMATION_REQUIRED', 'EMAIL_NOT_VERIFIED'].includes(extractApiErrorCode(error) ?? '');

/** The job waiting on the confirmation ("Assistant coach"), when the server names it. */
export function confirmationJobTitle(error: unknown): string | null {
    const title = (error as { response?: { data?: { jobTitle?: unknown } } } | null)?.response?.data?.jobTitle;
    return typeof title === 'string' && title.trim() ? title.trim() : null;
}

/** Sends a new confirmation link to the signed-in person's own address. */
export const sendEmailConfirmation = () => apiClient.post('/auth/send-verification');
