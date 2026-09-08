import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../../i18n';
import { PlayerCardModal } from '../PlayerCardModal';
import { createPlayerCard, updatePlayerCard, type PlayerCard } from '../../../features/clubs/api';

vi.mock('../../../features/clubs/api', () => ({
    createPlayerCard: vi.fn(),
    updatePlayerCard: vi.fn(),
}));

vi.mock('../../../api/axiosConfig', () => ({
    apiClient: {
        post: vi.fn(),
    },
}));

const activatedCard: PlayerCard = {
    id: 41,
    clubId: 7,
    userId: 19,
    fullName: 'Activated Player',
    birthYear: 2010,
    position: 'GOALKEEPER',
    jerseyNumber: 1,
    photoUrl: '/uploads/player.jpg',
    parentEmail: 'parent@example.com',
    registered: true,
    claimed: true,
};

describe('PlayerCardModal activated-account authority', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(updatePlayerCard).mockResolvedValue(activatedCard);
    });

    it('locks personal fields and sends only club-local roster changes', async () => {
        const onClose = vi.fn();
        const onCardUpdated = vi.fn();
        render(
            <PlayerCardModal
                clubId={7}
                isOpen
                onClose={onClose}
                card={activatedCard}
                onCardUpdated={onCardUpdated}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Edit Club Roster Details' })).toBeInTheDocument();
        expect(screen.getByLabelText('Full Name')).toBeDisabled();
        expect(screen.getByLabelText('Birth Year')).toBeDisabled();
        expect(screen.getByLabelText('Parent / Guardian Email')).toBeDisabled();
        expect(screen.queryByText('Upload photo')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'WINGER' } });
        fireEvent.change(screen.getByLabelText('Jersey Number'), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save Card' }));

        await waitFor(() => expect(updatePlayerCard).toHaveBeenCalledWith(7, 41, {
            position: 'WINGER',
            jerseyNumber: 7,
        }));
        expect(createPlayerCard).not.toHaveBeenCalled();
        expect(onCardUpdated).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });
});


describe('PlayerCardModal participation consent', () => {
    it.each([12, 14, 16, 18])('creates an age-%s card with the appropriate squad behavior', async (age) => {
        vi.clearAllMocks();
        vi.mocked(createPlayerCard).mockResolvedValue({ ...activatedCard, registered: false });
        render(<PlayerCardModal clubId={7} squadId={11} isOpen onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Player' } });
        fireEvent.change(screen.getByLabelText('Birth Year'), { target: { value: String(new Date().getFullYear() - age) } });
        if (age < 18) expect(screen.getByRole('status')).toHaveTextContent('Create the card first.');
        fireEvent.click(screen.getByRole('button', { name: 'Create Card' }));
        await waitFor(() => expect(createPlayerCard).toHaveBeenCalledOnce());
        expect(vi.mocked(createPlayerCard).mock.calls[0][1].squadId).toBe(age < 18 ? undefined : 11);
    });

    it('protects the parent contact of a claimed dormant card', async () => {
        vi.clearAllMocks();
        render(<PlayerCardModal clubId={7} isOpen card={{ ...activatedCard, registered: false }} onClose={vi.fn()} />);
        expect(screen.getByLabelText('Parent / Guardian Email')).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Save Card' }));
        await waitFor(() => expect(updatePlayerCard).toHaveBeenCalledOnce());
        expect(vi.mocked(updatePlayerCard).mock.calls[0][2]).not.toHaveProperty('parentEmail');
    });
});
