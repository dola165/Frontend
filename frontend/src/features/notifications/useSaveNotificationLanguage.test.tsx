import i18n from '../../i18n';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/notificationPreferences';
import { useSaveNotificationLanguage } from './useSaveNotificationLanguage';

vi.mock('../../api/notificationPreferences', () => ({ saveNotificationLanguage: vi.fn().mockResolvedValue(undefined) }));

describe('useSaveNotificationLanguage', () => {
    beforeEach(async () => { await act(() => i18n.changeLanguage('en')); vi.mocked(api.saveNotificationLanguage).mockClear(); });

    it('saves the language a signed-in person switches to, for push and email', async () => {
        await act(() => i18n.changeLanguage('en'));
        const { unmount } = renderHook(() => useSaveNotificationLanguage(true));
        await act(() => i18n.changeLanguage('ka'));
        await waitFor(() => expect(api.saveNotificationLanguage).toHaveBeenCalledWith('ka'));
        await act(() => i18n.changeLanguage('ka'));
        expect(api.saveNotificationLanguage).toHaveBeenCalledTimes(1);
        unmount();
    });

    it('saves nothing for a visitor who is not signed in', async () => {
        await act(() => i18n.changeLanguage('en'));
        const { unmount } = renderHook(() => useSaveNotificationLanguage(false));
        await act(() => i18n.changeLanguage('ka'));
        expect(api.saveNotificationLanguage).not.toHaveBeenCalled();
        unmount();
    });
});
