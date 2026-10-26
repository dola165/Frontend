import { extractApiErrorCode } from '../../utils/apiError';

/**
 * The backend's refusal of an action that needs a confirmed email (inviting people, making a club or page public,
 * money). Sign-in and everything else work without it; show `ConfirmEmailFirst` at the refused spot.
 */
export const needsConfirmedEmail = (error: unknown) => extractApiErrorCode(error) === 'EMAIL_NOT_VERIFIED';
