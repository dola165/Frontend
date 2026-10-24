import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/notificationPreferences';
import * as push from '../../features/notifications/pushSubscription';
import { TurnOnNotificationsPrompt } from './TurnOnNotificationsPrompt';

vi.mock('../../api/notificationPreferences', () => ({ fetchNotificationPreferences: vi.fn(), setNotificationGroup: vi.fn() }));
vi.mock('../../features/notifications/pushSubscription', () => ({ usePushDevice: vi.fn() }));

const preferences = (teamPush: boolean): api.NotificationPreferences => ({
    mode: 'LIVE', pushConfigured: true, pushPublicKey: 'BKEY', email: 'beqa@example.com', emailVerified: true, emailUnsubscribed: false,
    language: 'en', timeZone: 'Asia/Tbilisi', quietFrom: null, quietUntil: null, digestTime: '18:00',
    groups: [{ key: 'TEAM_WORK', push: teamPush, email: false }, { key: 'CLUB', push: false, email: false }], devices: [],
});
const device = (state: push.DeviceState, enable = vi.fn()) => ({ state, busy: false, failure: null, enable, disable: vi.fn(), refresh: vi.fn(), language: 'en' as const });

describe('TurnOnNotificationsPrompt', () => {
    beforeEach(() => { localStorage.clear(); vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(preferences(false)); });

    it('turns the group on and subscribes this device in one tap', async () => {
        const enable = vi.fn().mockResolvedValue({ ok: true, preferences: preferences(true) });
        vi.mocked(push.usePushDevice).mockReturnValue(device('off', enable));
        vi.mocked(api.setNotificationGroup).mockResolvedValue(preferences(true));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
        await waitFor(() => expect(enable).toHaveBeenCalled());
        expect(api.setNotificationGroup).toHaveBeenCalledWith('TEAM_WORK', { push: true, language: 'en' });
        expect(await screen.findByText(/Notifications are on for this device/)).toBeInTheDocument();
    });

    it('says nothing when this device already gets Team work pushes', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(preferences(true));
        vi.mocked(push.usePushDevice).mockReturnValue(device('on'));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await waitFor(() => expect(api.fetchNotificationPreferences).toHaveBeenCalled());
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
    });

    it('explains the Home Screen on an iPhone and stays quiet once dismissed', async () => {
        vi.mocked(push.usePushDevice).mockReturnValue(device('needs-home-screen'));
        const { unmount } = render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
        unmount();
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
        expect(localStorage.getItem('gk.notifications.prompt.TEAM_WORK.dismissed')).toBe('1');
    });
});
