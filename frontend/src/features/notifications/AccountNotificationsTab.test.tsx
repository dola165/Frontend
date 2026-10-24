import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../api/notificationPreferences';
import * as push from './pushSubscription';
import { AccountNotificationsTab } from './AccountNotificationsTab';

vi.mock('../../api/notificationPreferences', () => ({
    fetchNotificationPreferences: vi.fn(), saveNotificationPreferences: vi.fn(), removePushDevice: vi.fn(), sendTestNotification: vi.fn(),
}));
vi.mock('./pushSubscription', () => ({ usePushDevice: vi.fn() }));

const base: api.NotificationPreferences = {
    mode: 'LIVE', pushConfigured: true, pushPublicKey: 'BKEY', email: 'beqa@example.com', emailVerified: true, emailUnsubscribed: false,
    language: 'en', timeZone: 'Asia/Tbilisi', quietFrom: null, quietUntil: null, digestTime: '18:00',
    groups: [{ key: 'TEAM_WORK', push: false, email: false }, { key: 'MESSAGES', push: false, email: false }, { key: 'CLUB', push: false, email: false }],
    devices: [{ id: 7, device: 'Chrome on Windows', createdAt: '2026-10-24T10:00:00Z', lastUsedAt: null }],
};

describe('AccountNotificationsTab', () => {
    beforeEach(() => {
        vi.mocked(push.usePushDevice).mockReturnValue({ state: 'on', busy: false, failure: null, enable: vi.fn(), disable: vi.fn(), refresh: vi.fn(), language: 'en' });
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(base);
    });

    it('shows every group off and saves the choices with the browser time zone', async () => {
        vi.mocked(api.saveNotificationPreferences).mockImplementation(async update => ({ ...base, groups: update.groups ?? base.groups, quietFrom: update.quietFrom ?? null, quietUntil: update.quietUntil ?? null }));
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        const teamPush = await screen.findByRole('checkbox', { name: 'Team work: push' });
        expect(teamPush).not.toBeChecked();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        await userEvent.click(teamPush);
        await userEvent.click(screen.getByRole('checkbox', { name: 'Club: email' }));
        await userEvent.click(screen.getByRole('checkbox', { name: /Quiet hours/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(api.saveNotificationPreferences).toHaveBeenCalled());
        const update = vi.mocked(api.saveNotificationPreferences).mock.calls[0][0];
        expect(update.groups).toEqual([{ key: 'TEAM_WORK', push: true, email: false }, { key: 'MESSAGES', push: false, email: false }, { key: 'CLUB', push: false, email: true }]);
        expect(update.quietFrom).toBe('22:00');
        expect(update.quietUntil).toBe('08:00');
        expect(update.timeZone).toBeTruthy();
        expect(await screen.findByText('Saved.')).toBeInTheDocument();
        expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    });

    it('offers to turn email back on after an unsubscribe link, and disables the email column meanwhile', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...base, emailUnsubscribed: true });
        vi.mocked(api.saveNotificationPreferences).mockResolvedValue(base);
        render(<MemoryRouter initialEntries={['/account?tab=notifications&unsubscribed=1']}><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByText(/Email notifications are now off/)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Club: email' })).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: 'Turn email back on' }));
        await waitFor(() => expect(api.saveNotificationPreferences).toHaveBeenCalledWith(expect.objectContaining({ emailUnsubscribed: false })));
    });

    it('sends a test and says where it went', async () => {
        vi.mocked(api.sendTestNotification).mockResolvedValue({ mode: 'LIVE', pushDevices: 1, email: false });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Send a test' }));
        expect(await screen.findByText(/On its way to 1 device/)).toBeInTheDocument();
        expect(api.sendTestNotification).toHaveBeenCalledWith('en');
    });

    it('explains the iPhone Home Screen step on this device', async () => {
        vi.mocked(push.usePushDevice).mockReturnValue({ state: 'needs-home-screen', busy: false, failure: null, enable: vi.fn(), disable: vi.fn(), refresh: vi.fn(), language: 'en' });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /on this device/ })).not.toBeInTheDocument();
    });
});
