import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { PlayerCardModal } from '../PlayerCardModal';
vi.mock('../../../features/parents/FamilyClubEnrollment', () => ({ FamilyClubEnrollment: () => null }));
vi.mock('../RosterPlayerIdentity', () => ({ RosterPlayerIdentity: ({playerId}: {playerId: number}) => <p>Shared identity {playerId}</p> }));
import { createPlayerCard, updatePlayerCard, type PlayerCard } from '../../../features/clubs/api';

vi.mock('../../../features/parents/familyLinks', () => ({ clubCardFamilyLink: vi.fn() }));
vi.mock('../../../features/parents/FamilyLinkShare', () => ({
    FamilyLinkShare: ({ load, label }: { load: () => Promise<unknown>; label: string }) => <button type="button" onClick={() => void load()}>{label}</button>,
}));
import { clubCardFamilyLink } from '../../../features/parents/familyLinks';

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


describe('PlayerCardModal new cards and consent', () => {
    it('creates a child’s card for the squad and opens the family’s link at once', async () => {
        vi.clearAllMocks();
        vi.mocked(createPlayerCard).mockResolvedValue({ id: 5, userId: 61, fullName: 'Luka Beridze', birthYear: 2015 });
        const onCardCreated = vi.fn(), onClose = vi.fn();
        render(<MemoryRouter><PlayerCardModal clubId={7} squadId={11} squadName="2015 Boys" isOpen onClose={onClose} onCardCreated={onCardCreated} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Luka Beridze' } });
        fireEvent.change(screen.getByLabelText('Birth Year'), { target: { value: '2015' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Card' }));
        await waitFor(() => expect(createPlayerCard).toHaveBeenCalledOnce());
        expect(vi.mocked(createPlayerCard).mock.calls[0]).toEqual([7, expect.objectContaining({ fullName: 'Luka Beridze', birthYear: 2015, squadId: 11 })]);
        expect(await screen.findByText('Luka joins 2015 Boys when the family opens this link and says yes.')).toBeInTheDocument();
        expect(onCardCreated).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Link for Luka’s family' }));
        expect(clubCardFamilyLink).toHaveBeenCalledWith(7, 61);
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onCardCreated).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
        expect(updatePlayerCard).not.toHaveBeenCalled();
    });

    it('an adult’s new card simply closes', async () => {
        vi.clearAllMocks();
        vi.mocked(createPlayerCard).mockResolvedValue({ id: 6, userId: 62, fullName: 'Giorgi Lomidze', birthYear: 1998 });
        const onClose = vi.fn();
        render(<MemoryRouter><PlayerCardModal clubId={7} squadId={11} isOpen onClose={onClose} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Giorgi Lomidze' } });
        fireEvent.change(screen.getByLabelText('Birth Year'), { target: { value: '1998' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create Card' }));
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
        expect(clubCardFamilyLink).not.toHaveBeenCalled();
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
