import { beforeEach, describe, expect, it, vi } from 'vitest';

const sonner = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('sonner', () => sonner);
vi.mock('../../api/axiosConfig', () => ({ apiClient: api }));

import { promptEmailConfirmation } from './emailConfirmationPrompt';

const refusal = (data: Record<string, unknown>) => ({ response: { status: 403, data } });

describe('the confirm-your-email prompt', () => {
    beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: {} }); });

    it('answers only the email refusal, once, with Resend to the signed-in address', async () => {
        expect(promptEmailConfirmation(refusal({ code: 'PAGE_EXISTS' }))).toBe(false);
        expect(sonner.toast.warning).not.toHaveBeenCalled();
        expect(promptEmailConfirmation(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'MONEY' }))).toBe(true);
        const [title, options] = sonner.toast.warning.mock.calls[0];
        expect(title).toBe('Confirm your email first');
        expect(options).toMatchObject({ id: 'confirm-email', action: { label: 'Resend' } });
        options.action.onClick();
        await vi.waitFor(() => expect(sonner.toast).toHaveBeenCalledWith('Sent. Check your inbox.', expect.anything()));
        expect(api.post).toHaveBeenCalledWith('/auth/send-verification');
    });

    it('says what waits on the email, from confirmFor', () => {
        promptEmailConfirmation(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', confirmFor: 'PUBLISH', action: 'publish_page' }));
        expect(sonner.toast.warning.mock.calls[0][0]).toBe('Confirm your email to publish');
    });

    it('names the job that waits on the email', () => {
        promptEmailConfirmation(refusal({ code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'JOB', jobTitle: 'Admin' }));
        expect(sonner.toast.warning.mock.calls[0][0]).toBe('Confirm your email to start as Admin');
    });
});
