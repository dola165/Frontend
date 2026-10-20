import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '../../../../i18n';
import { AccountSessionsTab } from '../AccountSessionsTab';
import type { AccountCenter } from '../useAccountCenter';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

const sessions = {
    activeCount: 2, revokedCount: 1, expiredCount: 0,
    sessions: [
        { id: 7, current: true, status: 'ACTIVE' as const, deviceName: 'Chrome on Windows', place: null,
            createdAt: '2026-10-20T08:00:00Z', lastUsedAt: '2026-10-20T10:00:00Z' },
        { id: 3, current: false, status: 'ACTIVE' as const, deviceName: 'Safari on iPhone', place: 'Tbilisi, Georgia',
            createdAt: '2026-10-01T08:00:00Z', lastUsedAt: '2026-10-19T21:00:00Z' },
        { id: 2, current: false, status: 'ACTIVE' as const, deviceName: 'Unknown device', place: null,
            createdAt: '2026-10-20T00:00:00Z', lastUsedAt: '2026-10-20T00:00:00Z' },
    ],
};

const props = (overrides: Partial<Parameters<typeof AccountSessionsTab>[0]> = {}) => ({
    account: { sessionsSupported: true, sessionRevocationSupported: true } as NonNullable<AccountCenter['account']>,
    sessions, sessionsLoading: false, sessionsError: null, loadSessions: vi.fn(),
    revokingSessions: false, revokeOtherSessions: vi.fn(), endingSessionId: null, endSession: vi.fn(),
    ...overrides,
});

it('lists every signed-in device with its name and place and marks this device', () => {
    render(<AccountSessionsTab {...props()} />);
    const list = screen.getByRole('list', { name: 'Signed-in devices' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Chrome on Windows')).toBeVisible();
    expect(within(rows[0]).getByText('This device')).toBeVisible();
    expect(within(rows[0]).queryByRole('button')).toBeNull();
    expect(within(rows[1]).getByText(/Tbilisi, Georgia/)).toBeVisible();
    expect(within(rows[1]).getByText(/Last active/)).toBeVisible();
    expect(within(rows[2]).getByText('Unknown device')).toBeVisible();
});

it('signs out one other device or all others', () => {
    const endSession = vi.fn(), revokeOtherSessions = vi.fn();
    render(<AccountSessionsTab {...props({ endSession, revokeOtherSessions })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out Safari on iPhone' }));
    expect(endSession).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out Others' }));
    expect(revokeOtherSessions).toHaveBeenCalledOnce();
});

it('offers no sign-out of others when this is the only device', () => {
    render(<AccountSessionsTab {...props({ sessions: { ...sessions, activeCount: 1, sessions: [sessions.sessions[0]] } })} />);
    expect(screen.queryByRole('button', { name: 'Sign Out Others' })).toBeNull();
});
