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
