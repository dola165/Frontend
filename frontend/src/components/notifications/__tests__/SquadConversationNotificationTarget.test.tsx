import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SquadConversationNotificationTarget } from '../SquadConversationNotificationTarget';
const overview = vi.hoisted(() => vi.fn());
vi.mock('../../../features/squadCommunication/api', () => ({ overview }));
vi.mock('../../../features/squadCommunication/SquadMessages', () => ({ SquadMessages: ({ thread }: { thread: number | null }) => <p>Thread: {thread ?? 'group'}</p> }));
const space = { id: 5, name: 'U14', can_manage: true, viewer_id: 1, threads: [{ user_id: 12 }] };
const panel = (channel = 'coach', thread: string | null = '12', squadId = '5') => <MemoryRouter><SquadConversationNotificationTarget squadId={squadId} channel={channel} thread={thread} onClose={vi.fn()} /></MemoryRouter>;
describe('squad notification conversation', () => {
    beforeEach(() => { overview.mockReset(); });
    it('retains the exact private thread after checking current squad access', async () => {
        overview.mockResolvedValue(space); render(panel());
        expect(await screen.findByText('Thread: 12')).toBeInTheDocument();
        expect(overview).toHaveBeenCalledWith(5, expect.any(AbortSignal));
    });
    it('opens the selected squad group conversation', async () => {
        overview.mockResolvedValue(space); render(panel('chat', null));
        expect(await screen.findByText('Thread: group')).toBeInTheDocument();
    });
    it('does not substitute a different thread when the intended one is no longer accessible', async () => {
        overview.mockResolvedValue({ ...space, can_manage: false, viewer_id: 13 }); render(panel());
        expect(await screen.findByRole('alert')).toHaveTextContent('no longer have access');
        expect(screen.queryByText(/Thread:/)).not.toBeInTheDocument();
    });
    it('allows the recipient to read their own thread', async () => {
        overview.mockResolvedValue({ ...space, can_manage: false, viewer_id: 12 }); render(panel());
        expect(await screen.findByText('Thread: 12')).toBeInTheDocument();
    });
    it('rejects a coach thread missing from current permissions', async () => {
        overview.mockResolvedValue({ ...space, threads: [] }); render(panel());
        expect(await screen.findByRole('alert')).toHaveTextContent('no longer have access');
    });
    it('handles revoked squad access', async () => {
        overview.mockRejectedValue({ response: { status: 403 } }); render(panel());
        expect(await screen.findByRole('alert')).toHaveTextContent('no longer have access');
    });
    it('rejects missing or invalid identifiers before requesting data', () => {
        render(panel('coach', null)); expect(screen.getByRole('alert')).toHaveTextContent('unavailable'); expect(overview).not.toHaveBeenCalled();
    });
});
