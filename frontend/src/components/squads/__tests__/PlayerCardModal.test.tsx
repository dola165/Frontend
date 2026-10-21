import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { PlayerCardModal } from '../PlayerCardModal';
vi.mock('../../../features/parents/FamilyClubEnrollment', () => ({ FamilyClubEnrollment: () => null }));
vi.mock('../RosterPlayerIdentity', () => ({ RosterPlayerIdentity: ({playerId}: {playerId: number}) => <p>Shared identity {playerId}</p> }));
import { createPlayerCard, updatePlayerCard, type PlayerCard } from '../../../features/clubs/api';

vi.mock('../../../features/clubs/api', () => ({
    createPlayerCard: vi.fn(),
    updatePlayerCard: vi.fn(),
}));

vi.mock('../../../hooks/useMediaSource', () => ({ useMediaSource: (source?: string) => source }));

vi.mock('../../../api/axiosConfig', () => ({
    DEPLOYMENT_URLS: { mediaBaseUrl: 'https://media.example.test' },
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
        expect(screen.getByText('Shared identity 19')).toBeInTheDocument();

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
    it('takes new players to connected intake rather than creating a duplicate identity or a placement', () => {
        vi.clearAllMocks();
        render(<MemoryRouter><PlayerCardModal clubId={7} squadId={11} isOpen onClose={vi.fn()} /></MemoryRouter>);
        expect(screen.getByRole('link', {name:'Open player intake'})).toHaveAttribute('href','/clubs/7/workspace?tab=admissions&intake=1&squad=11');
        expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
        expect(createPlayerCard).not.toHaveBeenCalled();expect(updatePlayerCard).not.toHaveBeenCalled();
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
