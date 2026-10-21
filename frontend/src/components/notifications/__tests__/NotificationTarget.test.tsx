import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationTarget } from '../NotificationTarget';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get } }));
const event = (title: string) => ({ title, eventId: 12, startsAt: '2026-01-01T10:00:00', endsAt: '2026-01-01T12:00:00', status: 'CANCELLED', clubName: 'Club', description: 'Recorded event', recurring: false });
describe('notification target', () => {
    beforeEach(() => { get.mockReset(); });
    it('loads the exact event independently of the current calendar window', async () => {
        get.mockResolvedValue({ data: event('Old cancelled cup') });
        const close = vi.fn();
        render(<NotificationTarget kind="event" id="12" onClose={close} />);
        expect(await screen.findByText('Old cancelled cup')).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith('/schedule/events/12');
        expect(screen.getByText(/CANCELLED/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Close details')); expect(close).toHaveBeenCalled();
    });
    it.each([403, 404, 410])('explains unavailable or revoked targets (%s)', async status => {
        get.mockRejectedValue({ response: { status } });
        render(<NotificationTarget kind="event" id="12" onClose={vi.fn()} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('unavailable or you no longer have access');
        expect(screen.queryByText('Recorded event')).not.toBeInTheDocument();
    });
    it('retries a failed load', async () => {
        get.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce({ data: event('Recovered cup') });
        render(<NotificationTarget kind="event" id="12" onClose={vi.fn()} />);
        fireEvent.click(await screen.findByText('Try again'));
        expect(await screen.findByText('Recovered cup')).toBeInTheDocument();
    });
    it('ignores stale results after navigating to another notification', async () => {
        let resolve: (value: unknown) => void = () => undefined;
        get.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce({ data: event('Current cup') });
        const view = render(<NotificationTarget kind="event" id="12" onClose={vi.fn()} />);
        view.rerender(<NotificationTarget kind="event" id="13" onClose={vi.fn()} />);
        expect(await screen.findByText('Current cup')).toBeInTheDocument();
        await act(async () => resolve({ data: event('Stale cup') }));
        expect(screen.queryByText('Stale cup')).not.toBeInTheDocument();
    });
    it('loads a recipient-owned recorded outcome', async () => {
        get.mockResolvedValue({ data: { title: 'Club dissolved', body: 'Your club has closed.' } });
        render(<NotificationTarget kind="outcome" id="31" onClose={vi.fn()} />);
        expect(await screen.findByText('Your club has closed.')).toBeInTheDocument();
        expect(get).toHaveBeenCalledWith('/notifications/31');
    });
    it('rejects malformed identifiers without a request', async () => {
        render(<NotificationTarget kind="event" id="../../private" onClose={vi.fn()} />);
        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(get).not.toHaveBeenCalled();
    });
});
