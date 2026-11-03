import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/notificationPreferences';
import * as push from '../../features/notifications/pushSubscription';
import { TurnOnNotificationsPrompt } from './TurnOnNotificationsPrompt';

vi.mock('../../api/notificationPreferences', () => ({ fetchNotificationPreferences: vi.fn(), turnOnNeededNotifications: vi.fn() }));
vi.mock('../../features/notifications/pushSubscription', () => ({ usePushDevice: vi.fn() }));
vi.mock('../auth/emailConfirmation', () => ({ sendEmailConfirmation: vi.fn().mockResolvedValue({}) }));

const PARENT: api.NotificationGroupKey[] = ['MESSAGES', 'FAMILY', 'SQUAD_UPDATES', 'MATCHES', 'CLUB'];
const preferences = (on: boolean, extra: Partial<api.NotificationPreferences> = {}): api.NotificationPreferences => ({
    mode: 'LIVE', pushConfigured: true, pushPublicKey: 'BKEY', email: 'nino@example.test', emailVerified: true, emailUnsubscribed: false,
    language: 'en', timeZone: 'Asia/Tbilisi', quietFrom: null, quietUntil: null, digestTime: '18:00',
    groups: PARENT.map(key => ({ key, push: on, email: on })), devices: [], needed: PARENT, ...extra,
});
const device = (state: push.DeviceState, enable = vi.fn()) => ({ state, busy: false, failure: null, enable, disable: vi.fn(), refresh: vi.fn(), language: 'en' as const });

describe('TurnOnNotificationsPrompt', () => {
    beforeEach(() => { localStorage.clear(); vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(preferences(false)); });

    it('turns on everything a parent needs and subscribes this device in one press', async () => {
        const enable = vi.fn().mockResolvedValue({ ok: true, preferences: preferences(true) });
        vi.mocked(push.usePushDevice).mockReturnValue(device('off', enable));
        vi.mocked(api.turnOnNeededNotifications).mockResolvedValue(preferences(true));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
        await waitFor(() => expect(enable).toHaveBeenCalled());
        expect(api.turnOnNeededNotifications).toHaveBeenCalledWith('en');
        expect(await screen.findByText(/Notifications are on/)).toBeInTheDocument();
        expect(screen.getByText('News also reaches nino@example.test.')).toBeInTheDocument();
    });

    it('after the press, says plainly when the email is not confirmed yet, with Resend', async () => {
        const unconfirmed = preferences(true, { emailVerified: false });
        vi.mocked(push.usePushDevice).mockReturnValue(device('off', vi.fn().mockResolvedValue({ ok: true, preferences: unconfirmed })));
        vi.mocked(api.turnOnNeededNotifications).mockResolvedValue(unconfirmed);
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
        expect(await screen.findByText('Confirm nino@example.test to get news by email')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    });

    it('turns the rest on when this device already gets pushes but a needed kind is off', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...preferences(true), groups: [...preferences(true).groups.filter(g => g.key !== 'MATCHES'), { key: 'MATCHES', push: false, email: false }] });
        const enable = vi.fn();
        vi.mocked(push.usePushDevice).mockReturnValue(device('on', enable));
        vi.mocked(api.turnOnNeededNotifications).mockResolvedValue(preferences(true));
        render(<MemoryRouter><TurnOnNotificationsPrompt reason="When a session moves." /></MemoryRouter>);
        expect(await screen.findByText('When a session moves.')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }));
        await waitFor(() => expect(api.turnOnNeededNotifications).toHaveBeenCalled());
        expect(enable).not.toHaveBeenCalled();
    });

    it('says why when the browser refuses, after the news itself is on', async () => {
        const enable = vi.fn().mockResolvedValue({ ok: false, reason: 'denied' });
        const state = { current: device('off', enable) };
        vi.mocked(push.usePushDevice).mockImplementation(() => state.current);
        vi.mocked(api.turnOnNeededNotifications).mockResolvedValue(preferences(true));
        const { rerender } = render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
        await waitFor(() => expect(enable).toHaveBeenCalled());
        state.current = { ...device('denied', enable), failure: 'denied' as never };
        rerender(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        expect(await screen.findByRole('alert')).toHaveTextContent('This browser blocks notifications');
        expect(api.turnOnNeededNotifications).toHaveBeenCalledWith('en');
    });

    it('says so when turning on fails, and the press can be tried again', async () => {
        const enable = vi.fn().mockResolvedValue({ ok: true, preferences: preferences(true) });
        vi.mocked(push.usePushDevice).mockReturnValue(device('off', enable));
        vi.mocked(api.turnOnNeededNotifications).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(preferences(true));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('That did not work. Try again in a moment.');
        expect(enable).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }));
        expect(await screen.findByText(/Notifications are on/)).toBeInTheDocument();
        expect(enable).toHaveBeenCalledTimes(1);
    });

    it('takes one press while turning on is under way', async () => {
        let answer: (value: api.NotificationPreferences) => void = () => undefined;
        vi.mocked(api.turnOnNeededNotifications).mockClear().mockReturnValue(new Promise(resolve => { answer = resolve; }));
        vi.mocked(push.usePushDevice).mockReturnValue(device('off', vi.fn().mockResolvedValue({ ok: true, preferences: preferences(true) })));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        const button = await screen.findByRole('button', { name: 'Turn on notifications' });
        await userEvent.click(button);
        expect(button).toBeDisabled();
        await userEvent.click(button);
        expect(api.turnOnNeededNotifications).toHaveBeenCalledTimes(1);
        answer(preferences(true));
        expect(await screen.findByText(/Notifications are on/)).toBeInTheDocument();
    });

    it('is not offered to someone with no club, squad or family links', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(preferences(false, { needed: ['MESSAGES'] }));
        vi.mocked(push.usePushDevice).mockReturnValue(device('off'));
        render(<MemoryRouter><p>Page</p><TurnOnNotificationsPrompt /></MemoryRouter>);
        await waitFor(() => expect(api.fetchNotificationPreferences).toHaveBeenCalled());
        expect(screen.getByText('Page')).toBeInTheDocument();
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
    });

    it('says nothing when this device already gets everything needed', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(preferences(true));
        vi.mocked(push.usePushDevice).mockReturnValue(device('on'));
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await waitFor(() => expect(api.fetchNotificationPreferences).toHaveBeenCalled());
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
    });

    it('explains the Home Screen on an iPhone once', async () => {
        vi.mocked(push.usePushDevice).mockReturnValue(device('needs-home-screen'));
        const { unmount } = render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
        unmount();
        const calls = vi.mocked(api.fetchNotificationPreferences).mock.calls.length;
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await waitFor(() => expect(api.fetchNotificationPreferences).toHaveBeenCalledTimes(calls + 1));
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
    });

    it('stays quiet once dismissed', async () => {
        vi.mocked(push.usePushDevice).mockReturnValue(device('off'));
        const { unmount } = render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
        unmount();
        render(<MemoryRouter><TurnOnNotificationsPrompt /></MemoryRouter>);
        expect(screen.queryByTestId('turn-on-notifications')).not.toBeInTheDocument();
    });
});
