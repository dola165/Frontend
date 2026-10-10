import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementComposer } from '../AnnouncementComposer';
import * as api from '../../squadCommunication/api';

vi.mock('../../squadCommunication/api', () => ({ postMessage: vi.fn() }));
const space = { id: 105, name: 'U16 Boys', can_manage: true } as api.SquadOverview;

function write() {
    fireEvent.click(screen.getByRole('button', { name: /New announcement/ }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Kit change' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Black away kit on Monday.' } });
}

describe('posting an announcement', () => {
    afterEach(() => { cleanup(); vi.clearAllMocks(); });

    it('pins it until the chosen day and asks families to confirm by default', async () => {
        vi.mocked(api.postMessage).mockResolvedValue({} as never);
        const posted = vi.fn();
        render(<AnnouncementComposer space={space} onPosted={posted} />);
        write();
        fireEvent.click(screen.getByRole('radio', { name: '3 days' }));
        fireEvent.click(screen.getByRole('button', { name: 'Post announcement' }));
        expect(await screen.findByText(/Posted\. Pinned for U16 Boys until/)).toBeInTheDocument();
        const body = vi.mocked(api.postMessage).mock.calls[0][1];
        expect(body).toMatchObject({ kind: 'ANNOUNCEMENT', title: 'Kit change', important: true, threadUserId: null });
        const expected = new Date(); expected.setDate(expected.getDate() + 3); expected.setHours(23, 59, 0, 0);
        expect(body.expiresAt).toBe(expected.toISOString());
        expect(posted).toHaveBeenCalled();
    });

    it('keeps the text and the request id when posting fails, so a retry cannot post twice', async () => {
        vi.mocked(api.postMessage).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({} as never);
        render(<AnnouncementComposer space={space} onPosted={vi.fn()} />);
        write();
        fireEvent.click(screen.getByRole('switch'));
        fireEvent.click(screen.getByRole('button', { name: 'Post announcement' }));
        expect(await screen.findByText(/Your text is kept/)).toBeInTheDocument();
        expect(screen.getByLabelText('Title')).toHaveValue('Kit change');
        fireEvent.click(screen.getByRole('button', { name: 'Post announcement' }));
        await screen.findByText(/Posted\./);
        const [first, second] = vi.mocked(api.postMessage).mock.calls.map(call => call[1]);
        expect(second.requestId).toBe(first.requestId);
        expect(second.important).toBe(false);
    });
});
