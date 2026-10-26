import { describe, expect, it } from 'vitest';
import { confirmationJobTitle, needsConfirmedEmail } from './emailConfirmation';

const refusal = (data: Record<string, unknown>) => ({ response: { status: 403, data } });

describe('the confirm-your-email refusal', () => {
    it('is recognised by the backend code, old and new', () => {
        expect(needsConfirmedEmail(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'PUBLISH' }))).toBe(true);
        expect(needsConfirmedEmail(refusal({ code: 'EMAIL_NOT_VERIFIED' }))).toBe(true);
        expect(needsConfirmedEmail(refusal({ code: 'PARENT_APPROVAL_REQUIRED' }))).toBe(false);
        expect(needsConfirmedEmail(new Error('offline'))).toBe(false);
    });

    it('names the job waiting on it when the server does', () => {
        expect(confirmationJobTitle(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'JOB', jobTitle: 'Assistant coach' }))).toBe('Assistant coach');
        expect(confirmationJobTitle(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'INVITE' }))).toBeNull();
    });
});
