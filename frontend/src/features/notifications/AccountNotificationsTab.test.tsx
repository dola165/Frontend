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
    it('offers important emails deliberately, keeping optional chat and promotions off until saved', async () => {
        const groups: api.NotificationGroupChoice[] = ['CLUB', 'FAMILY', 'MATCHES', 'SQUAD_UPDATES', 'JOB_REQUESTS', 'MESSAGES', 'OTHER'].map(key => ({ key: key as api.NotificationGroupKey, push: false, email: false }));
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...base, groups });
        vi.mocked(api.saveNotificationPreferences).mockImplementation(async update => ({ ...base, groups: update.groups! }));
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByRole('checkbox', { name: 'Squad updates: email' })).not.toBeChecked();
        await userEvent.click(screen.getByRole('button', { name: 'Use recommended emails' }));
        expect(api.saveNotificationPreferences).not.toHaveBeenCalled();
        expect(screen.getByRole('checkbox', { name: 'Messages: email' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Other updates: email' })).not.toBeChecked();
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(api.saveNotificationPreferences).toHaveBeenCalled());
        const saved = vi.mocked(api.saveNotificationPreferences).mock.calls[0][0];
        expect(saved.groups?.filter(group => group.email).map(group => group.key)).toEqual(['CLUB', 'FAMILY', 'MATCHES', 'SQUAD_UPDATES', 'JOB_REQUESTS']);
        expect(saved.groups?.some(group => group.push)).toBe(false);
    });

    it('does not let recommended email choices bypass a global unsubscribe', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...base, emailUnsubscribed: true });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByRole('button', { name: 'Use recommended emails' })).toBeDisabled();
        expect(api.saveNotificationPreferences).not.toHaveBeenCalled();
    });

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(push.usePushDevice).mockReturnValue({ state: 'on', busy: false, failure: null, enable: vi.fn(), disable: vi.fn(), refresh: vi.fn(), language: 'en' });
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue(base);
    });

    it('shows every group off and preserves the saved time zone when saving choices', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...base, timeZone: 'Europe/London' });
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
        expect(update.timeZone).toBe('Europe/London');
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

    it('acknowledges a test without promising external delivery and shows its reference', async () => {
        vi.mocked(api.sendTestNotification).mockResolvedValue({ mode: 'LIVE', pushDevices: 1, email: false, eventReference: 1793350800000 });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Send a test' }));
        expect(await screen.findByText(/arrival is not confirmed/)).toBeInTheDocument();
        expect(screen.getByText('Test reference: 1793350800000')).toBeInTheDocument();
        expect(screen.queryByText(/20 seconds|On its way/)).not.toBeInTheDocument();
        expect(api.sendTestNotification).toHaveBeenCalledWith('en');
    });

    it('explains the iPhone Home Screen step on this device', async () => {
        vi.mocked(push.usePushDevice).mockReturnValue({ state: 'needs-home-screen', busy: false, failure: null, enable: vi.fn(), disable: vi.fn(), refresh: vi.fn(), language: 'en' });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /on this device/ })).not.toBeInTheDocument();
    });

    it('recovers a failed initial load with Try again', async () => {
        vi.mocked(api.fetchNotificationPreferences).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(base);
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('checkbox', { name: 'Club: email' })).not.toBeChecked();
        expect(api.fetchNotificationPreferences).toHaveBeenCalledTimes(2);
    });

    it('keeps a failed save draft and retries the same explicit choices', async () => {
        vi.mocked(api.saveNotificationPreferences).mockRejectedValueOnce(new Error('offline'))
            .mockImplementationOnce(async update => ({ ...base, groups: update.groups ?? base.groups }));
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        const email = await screen.findByRole('checkbox', { name: 'Club: email' });
        await userEvent.click(email);
        expect(screen.getByRole('button', { name: 'Send a test' })).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(email).toBeChecked();
        expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('Saved.')).toBeInTheDocument();
        expect(api.saveNotificationPreferences).toHaveBeenCalledTimes(2);
        expect(vi.mocked(api.saveNotificationPreferences).mock.calls[1][0]).toEqual(vi.mocked(api.saveNotificationPreferences).mock.calls[0][0]);
        expect(screen.getByRole('button', { name: 'Send a test' })).toBeEnabled();
    });

    it('locks inputs during a pending save so later edits cannot be silently lost', async () => {
        let finish!: (value: api.NotificationPreferences) => void;
        vi.mocked(api.saveNotificationPreferences).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        const email = await screen.findByRole('checkbox', { name: 'Club: email' });
        await userEvent.click(email);
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(email).toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Messages: push' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Send a test' })).toBeDisabled();
        finish({ ...base, groups: base.groups.map(group => group.key === 'CLUB' ? { ...group, email: true } : group) });
        expect(await screen.findByText('Saved.')).toBeInTheDocument();
        expect(email).toBeEnabled();
        expect(email).toBeChecked();
    });

    it.each(['OFF', 'DRY_RUN'] as const)('describes a test accurately in %s mode', async mode => {
        vi.mocked(api.fetchNotificationPreferences).mockResolvedValue({ ...base, mode });
        vi.mocked(api.sendTestNotification).mockResolvedValue({ mode, pushDevices: 1, email: true });
        render(<MemoryRouter><AccountNotificationsTab /></MemoryRouter>);
        await userEvent.click(await screen.findByRole('button', { name: 'Send a test' }));
        expect(await screen.findByText(mode === 'OFF'
            ? 'Test notification created in the app. Delivery outside the app is switched off.'
            : 'Test notification created in the app. Dry-run sends no email or push.')).toBeInTheDocument();
        expect(screen.queryByText(/20 seconds|On its way|server log/)).not.toBeInTheDocument();
    });

    it('does not trust an old unsubscribe query parameter over saved preferences', async () => {
        render(<MemoryRouter initialEntries={['/account?tab=notifications&unsubscribed=1']}><AccountNotificationsTab /></MemoryRouter>);
        expect(await screen.findByRole('checkbox', { name: 'Club: email' })).toBeEnabled();
        expect(screen.queryByText(/Email notifications are now off/)).not.toBeInTheDocument();
    });
});
