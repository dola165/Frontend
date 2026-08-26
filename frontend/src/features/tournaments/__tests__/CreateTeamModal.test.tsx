import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTeamModal } from '../components/CreateTeamModal';
import type { DraftTeamDetailDto, TournamentEntryDto } from '../domain';

vi.mock('../api', () => ({
    addDraftTeamFakeMember: vi.fn(),
    addDraftTeamMembers: vi.fn(),
    createDraftTeam: vi.fn(),
    disbandDraftTeam: vi.fn(),
    fetchDraftTeam: vi.fn(),
    fetchDraftTeams: vi.fn(),
    promoteDraftTeam: vi.fn(),
    removeDraftTeamFakeMember: vi.fn(),
    removeDraftTeamMember: vi.fn(),
    updateDraftTeam: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import {
    addDraftTeamFakeMember,
    addDraftTeamMembers,
    createDraftTeam,
    fetchDraftTeam,
    fetchDraftTeams,
    promoteDraftTeam,
    removeDraftTeamFakeMember,
    updateDraftTeam,
} from '../api';

const makeDetail = (overrides: Partial<DraftTeamDetailDto> = {}): DraftTeamDetailDto => ({
    id: 7,
    name: 'Tbilisi Mix',
    status: 'FORMING',
    promotedEntryId: null,
    createdBy: null,
    createdAt: '2026-07-01T00:00:00',
    members: [],
    fakeMembers: [],
    ...overrides,
});

const makeEntry = (overrides: Partial<TournamentEntryDto> = {}): TournamentEntryDto => ({
    id: 21,
    clubId: null,
    clubName: null,
    squadId: null,
    squadName: null,
    userId: 21,
    displayName: 'Nika Player',
    status: 'ACTIVE',
    seed: null,
    requestedBy: null,
    decidedBy: null,
    decidedAt: null,
    confirmedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    draftTeamId: null,
    ...overrides,
});

const renderModal = (
    props: Partial<{ tournamentId: number; entries: TournamentEntryDto[]; teamId: number | null; onRefresh: () => void }> = {},
) =>
    render(
        <CreateTeamModal
            tournamentId={1}
            entries={props.entries ?? []}
            teamId={props.teamId ?? null}
            onClose={() => {}}
            onRefresh={props.onRefresh ?? (() => {})}
        />,
    );

const createTeamFlow = async (name = 'Tbilisi Mix') => {
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('tournaments.diagram.teamName'), name);
    await user.click(screen.getByTitle('tournaments.diagram.create'));
    await waitFor(() => expect(createDraftTeam).toHaveBeenCalled());
    await screen.findByText('tournaments.diagram.sendToBracket');
};

describe('CreateTeamModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (createDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail());
        (fetchDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail());
        (fetchDraftTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (updateDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail({ name: 'Metro Mix' }));
        (promoteDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail());
        (addDraftTeamFakeMember as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeDetail({ fakeMembers: [{ id: 5, name: 'Giorgi Fake' }] }),
        );
        (removeDraftTeamFakeMember as ReturnType<typeof vi.fn>).mockResolvedValue(makeDetail());
    });

    it('creates a team and opens its roster in the workspace', async () => {
        renderModal();
        await createTeamFlow();
        expect(createDraftTeam).toHaveBeenCalledWith(1, { name: 'Tbilisi Mix' });
        expect(await screen.findAllByText('Tbilisi Mix')).not.toHaveLength(0);
    });

    it('adds an off-platform player by name', async () => {
        renderModal();
        await createTeamFlow();
        const input = screen.getByPlaceholderText('tournaments.diagram.fakePlayerPlaceholder');
        await userEvent.type(input, 'Giorgi Fake');
        await userEvent.click(screen.getByTitle('tournaments.diagram.addFakePlayer'));
        await waitFor(() => expect(addDraftTeamFakeMember).toHaveBeenCalled());
        expect(addDraftTeamFakeMember).toHaveBeenCalledWith(1, 7, { name: 'Giorgi Fake' });
    });

    it('removes a fake member only after confirmation', async () => {
        (fetchDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeDetail({ fakeMembers: [{ id: 5, name: 'Giorgi Fake' }] }),
        );
        renderModal();
        await createTeamFlow();
        await screen.findByText('Giorgi Fake');
        fireEvent.click(screen.getByTitle('tournaments.diagram.removeMember'));
        expect(removeDraftTeamFakeMember).not.toHaveBeenCalled();
        const confirmButtons = screen.getAllByRole('button', { name: 'tournaments.diagram.removeMember' });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]);
        await waitFor(() => expect(removeDraftTeamFakeMember).toHaveBeenCalled());
        expect(removeDraftTeamFakeMember).toHaveBeenCalledWith(1, 7, 5);
    });

    it('opens an existing team in the workspace', async () => {
        (fetchDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue(
            makeDetail({ name: 'Tbilisi Mix', fakeMembers: [{ id: 5, name: 'Giorgi Fake' }] }),
        );
        renderModal({ teamId: 7 });
        expect(await screen.findByText('Tbilisi Mix')).toBeInTheDocument();
        expect(await screen.findByText('Giorgi Fake')).toBeInTheDocument();
        expect(fetchDraftTeam).toHaveBeenCalledWith(1, 7);
    });

    it('renames the selected team inline', async () => {
        const user = userEvent.setup();
        (fetchDraftTeam as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(makeDetail({ name: 'Tbilisi Mix' }))
            .mockResolvedValue(makeDetail({ name: 'Metro Mix' }));
        renderModal({ teamId: 7 });
        await screen.findByText('Tbilisi Mix');
        await user.click(screen.getByTitle('tournaments.diagram.rename'));
        const input = screen.getByDisplayValue('Tbilisi Mix');
        await user.clear(input);
        await user.type(input, 'Metro Mix');
        await user.click(screen.getByTitle('tournaments.diagram.rename'));
        await waitFor(() => expect(updateDraftTeam).toHaveBeenCalled());
        expect(updateDraftTeam).toHaveBeenCalledWith(1, 7, { name: 'Metro Mix' });
        expect(await screen.findByText('Metro Mix')).toBeInTheDocument();
    });

    it('adds a platform player from the available list', async () => {
        renderModal({ teamId: 7, entries: [makeEntry()] });
        await screen.findByText('Nika Player');
        await userEvent.click(screen.getByTitle('tournaments.diagram.addMembers'));
        await waitFor(() => expect(addDraftTeamMembers).toHaveBeenCalled());
        expect(addDraftTeamMembers).toHaveBeenCalledWith(1, 7, { entryIds: [21] });
    });

    it('sends a ready team to the bracket', async () => {
        renderModal({ teamId: 7 });
        await screen.findByText('tournaments.diagram.sendToBracket');
        await userEvent.click(screen.getByText('tournaments.diagram.sendToBracket'));
        await waitFor(() => expect(promoteDraftTeam).toHaveBeenCalled());
        expect(promoteDraftTeam).toHaveBeenCalledWith(1, 7);
    });
});
