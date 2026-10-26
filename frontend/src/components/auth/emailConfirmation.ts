import { extractApiErrorCode } from '../../utils/apiError';

/**
 * The backend's refusal of an action that needs a confirmed email (inviting people, making a club or page public,
 * money): 403 EMAIL_CONFIRMATION_REQUIRED, with `action` INVITE, PUBLISH or MONEY (fnd-signup-b). The older
 * EMAIL_NOT_VERIFIED is read the same way. Sign-in and everything else work without it; show `ConfirmEmailFirst`
 * at the refused spot.
 */
export const needsConfirmedEmail = (error: unknown) => ['EMAIL_CONFIRMATION_REQUIRED', 'EMAIL_NOT_VERIFIED'].includes(extractApiErrorCode(error) ?? '');
