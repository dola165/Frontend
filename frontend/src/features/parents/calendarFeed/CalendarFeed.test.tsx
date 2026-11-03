import '../../../i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from './calendarFeedApi';
import { CalendarFeedRow } from './CalendarFeed';

vi.mock('./calendarFeedApi', async original => ({ ...await original<typeof api>(), calendarFeedStatus: vi.fn(), makeCalendarFeed: vi.fn(), stopCalendarFeed: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('makes the private link once and offers it to Google and Apple calendars', async () => {
    const user = userEvent.setup();
    vi.mocked(api.calendarFeedStatus).mockResolvedValue({ on: false, createdAt: null, lastReadAt: null });
    vi.mocked(api.makeCalendarFeed).mockResolvedValue({ path: '/api/calendar/family/abc.ics', createdAt: new Date().toISOString() });
    render(<CalendarFeedRow names={['Nika', 'Luka']} />);
    await user.click(screen.getByRole('button', { name: /phone’s calendar/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Nika, Luka/)).toBeInTheDocument();
    await user.click(await within(dialog).findByRole('button', { name: 'Make my link' }));
    expect(within(dialog).getByLabelText('Your private link')).toHaveValue(`${window.location.origin}/api/calendar/family/abc.ics`);
    const webcal = `webcal://${window.location.host}/api/calendar/family/abc.ics`;
    expect(within(dialog).getByRole('link', { name: 'Add on iPhone or Mac' })).toHaveAttribute('href', webcal);
    expect(within(dialog).getByRole('link', { name: 'Add to Google Calendar' })).toHaveAttribute('href', `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`);
});

it('says when a calendar last read the link, and stops it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.calendarFeedStatus).mockResolvedValue({ on: true, createdAt: '2026-11-01T10:00:00Z', lastReadAt: new Date(Date.now() - 3600000).toISOString() });
    vi.mocked(api.stopCalendarFeed).mockResolvedValue({} as never);
    render(<CalendarFeedRow names={['Nika']} />);
    await user.click(screen.getByRole('button', { name: /phone’s calendar/ }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Your link is on')).toBeInTheDocument();
    expect(within(dialog).getByText(/a calendar read it/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Stop the link' }));
    expect(api.stopCalendarFeed).toHaveBeenCalled();
    expect(await within(dialog).findByRole('button', { name: 'Make my link' })).toBeInTheDocument();
});
