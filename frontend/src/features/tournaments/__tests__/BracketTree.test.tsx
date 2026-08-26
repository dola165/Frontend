import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BracketTree } from '../components/BracketTree';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto } from '../domain';

vi.mock('../api', () => ({
    addDraftTeamFakeMember: vi.fn(),
    addDraftTeamMembers: vi.fn(),
    createDraftTeam: vi.fn(),
    disbandDraftTeam: vi.fn(),
    fetchDraftTeam: vi.fn(),
    fetchDraftTeams: vi.fn(),
    moveEntry: vi.fn(),
    promoteDraftTeam: vi.fn(),
    removeDraftTeamFakeMember: vi.fn(),
    removeDraftTeamMember: vi.fn(),
    replaceEntry: vi.fn(),
    updateEntrySquad: vi.fn(),
    updateFixtureParticipants: vi.fn(),
}));

vi.mock('../../../api/axiosConfig', () => ({
    apiClient: {
        get: vi.fn(async () => ({ data: [] })),
        post: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import { fetchDraftTeam, fetchDraftTeams, moveEntry, replaceEntry, updateFixtureParticipants } from '../api';

const makeEntry = (overrides: Partial<TournamentEntryDto> = {}): TournamentEntryDto => ({
    id: 1,
    clubId: 1,
    clubName: 'Creekside FC',
    squadId: null,
    squadName: null,
    userId: null,
    displayName: 'Creekside FC',
    status: 'ACTIVE',
    seed: 1,
    requestedBy: null,
    decidedBy: null,
    decidedAt: null,
    confirmedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    ...overrides,
});

const makeFixture = (overrides: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id: 10,
    stageId: 1,
    stageName: 'Knockout',
    homeEntryId: null,
    homeLabel: null,
    awayEntryId: null,
    awayLabel: null,
    winnerEntryId: null,
    homeScore: null,
    awayScore: null,
    roundNumber: 1,
    fixtureOrder: 1,
    scheduledAt: null,
    locationId: null,
    status: 'SCHEDULED',
    linkedMatchId: null,
    ...overrides,
});

const makeTournament = (entries: TournamentEntryDto[]): TournamentDetail => ({
    id: 1,
    name: 'Tree Cup',
    status: 'PLANNING',
    organizerOrganizationId: 1,
    participantScope: 'CLUB',
    visibility: 'PUBLIC',
    staffAssignments: [],
    entries,
    stages: [],
    fixtures: [],
});

const defaultEntries = [
    makeEntry(),
    makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
    makeEntry({ id: 3, clubId: 3, clubName: 'Riverside Rovers', displayName: 'Riverside Rovers', seed: 3 }),
];

const shellFixtures = [
    makeFixture({ id: 10, homeEntryId: 1, awayEntryId: 2, roundNumber: 1, fixtureOrder: 1 }),
    makeFixture({ id: 11, roundNumber: 1, fixtureOrder: 2 }),
    makeFixture({ id: 12, roundNumber: 2, fixtureOrder: 1 }),
];

const renderTree = (entries: TournamentEntryDto[] = defaultEntries, fixtures = shellFixtures, onRefresh = () => {}) =>
    render(
        <MemoryRouter>
            <BracketTree
                tournamentId={1}
                tournament={makeTournament(entries)}
                fixtures={fixtures}
                saving={false}
                canManage={true}
                onRefresh={onRefresh}
                onEditScores={() => {}}
                onComplete={() => {}}
                onReopen={() => {}}
                onCancelFixture={() => {}}
            />
        </MemoryRouter>,
    );

const transfer = { setData: vi.fn() };

describe('BracketTree', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (updateFixtureParticipants as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (moveEntry as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (replaceEntry as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (fetchDraftTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (fetchDraftTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: 1, name: 'Tbilisi Mix', status: 'FORMING', promotedEntryId: null,
            createdBy: null, createdAt: '2026-07-01T00:00:00', members: [], fakeMembers: [],
        });
    });

    it('renders the pool, round columns, drop zones, locked placeholders and connector paths', () => {
        const { container } = renderTree();
        expect(screen.getByText('tournaments.diagram.unplaced')).toBeInTheDocument();
        expect(screen.getByText('Riverside Rovers')).toBeInTheDocument();
        expect(screen.getAllByText('tournaments.bracket.round')).toHaveLength(2);
        expect(screen.getAllByText('tournaments.diagram.dropHere')).toHaveLength(2);
        expect(screen.getAllByText('tournaments.bracket.winnerOf')).toHaveLength(2);
        expect(container.querySelector('svg path')).toBeTruthy();
    });

    it('labels squad entries with their squad name', () => {
        renderTree([
            makeEntry(),
            makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
            makeEntry({
                id: 3,
                clubId: 3,
                clubName: 'Riverside Rovers',
                displayName: 'Riverside Rovers',
                squadId: 7,
                squadName: 'Riverside U18',
                seed: 3,
            }),
        ]);
        expect(screen.getByText('Riverside U18')).toBeInTheDocument();
    });

    it('drops a pool entry onto an empty slot via PATCH participants', async () => {
        renderTree();
        fireEvent.dragStart(screen.getByText('Riverside Rovers'), { dataTransfer: transfer });
        fireEvent.drop(screen.getAllByText('tournaments.diagram.dropHere')[0], { dataTransfer: transfer });
        await waitFor(() => expect(updateFixtureParticipants).toHaveBeenCalled());
        expect(updateFixtureParticipants).toHaveBeenCalledWith(1, 11, {
            homeEntryId: 3,
            awayEntryId: null,
        });
    });

    it('drops a pool entry onto an occupied slot via replace-entry', async () => {
        renderTree();
        fireEvent.dragStart(screen.getByText('Riverside Rovers'), { dataTransfer: transfer });
        fireEvent.drop(screen.getByText('Creekside FC'), { dataTransfer: transfer });
        await waitFor(() => expect(replaceEntry).toHaveBeenCalled());
        expect(replaceEntry).toHaveBeenCalledWith(1, 10, {
            slot: 'HOME',
            replacementEntryId: 3,
        });
    });

    it('clears a slot through the remove button after confirmation', async () => {
        renderTree();
        fireEvent.click(screen.getAllByTitle('tournaments.diagram.removeSlot')[0]);
        expect(updateFixtureParticipants).not.toHaveBeenCalled();
        const confirmButtons = screen.getAllByRole('button', { name: 'tournaments.diagram.removeSlot' });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]);
        await waitFor(() => expect(updateFixtureParticipants).toHaveBeenCalled());
        expect(updateFixtureParticipants).toHaveBeenCalledWith(1, 10, {
            homeEntryId: null,
            awayEntryId: 2,
        });
    });

    it('opens the profile modal with a working deep link on entry click', () => {
        renderTree();
        fireEvent.click(screen.getByText('Creekside FC'));
        expect(screen.getByText('tournaments.diagram.profileTitle')).toBeInTheDocument();
        expect(screen.getByText('tournaments.diagram.clubProfile')).toHaveAttribute('href', '/clubs/1');
    });

    it('moves an assigned squad between slots via move-entry', async () => {
        renderTree();
        fireEvent.dragStart(screen.getByText('Metro United'), { dataTransfer: transfer });
        fireEvent.drop(screen.getAllByText('tournaments.diagram.dropHere')[0], { dataTransfer: transfer });
        await waitFor(() => expect(moveEntry).toHaveBeenCalled());
        expect(moveEntry).toHaveBeenCalledWith(1, 10, {
            entryId: 2,
            targetFixtureId: 11,
            targetSlot: 'HOME',
        });
    });

    it('advances a squad to its natural next slot via the left advance button', async () => {
        renderTree();
        fireEvent.click(screen.getAllByTitle('tournaments.diagram.advance')[0]);
        await waitFor(() => expect(moveEntry).toHaveBeenCalled());
        expect(moveEntry).toHaveBeenCalledWith(1, 10, {
            entryId: 1,
            targetFixtureId: 12,
            targetSlot: 'HOME',
        });
    });

    it('renders per-squad scores and the winner on completed matches', () => {
        renderTree(
            [
                makeEntry(),
                makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
                makeEntry({ id: 3, clubId: 3, clubName: 'Riverside Rovers', displayName: 'Riverside Rovers', seed: 3 }),
            ],
            [
                makeFixture({ id: 10, homeEntryId: 1, awayEntryId: 2, roundNumber: 1, fixtureOrder: 1, status: 'COMPLETED', homeScore: 2, awayScore: 1, winnerEntryId: 1 }),
                makeFixture({ id: 11, homeEntryId: 3, roundNumber: 1, fixtureOrder: 2 }),
                makeFixture({ id: 12, roundNumber: 2, fixtureOrder: 1 }),
            ],
        );
        expect(screen.getAllByText('2')).toHaveLength(1);
        expect(screen.getAllByText('1')).toHaveLength(1);
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });

    it('shows the squad name in small text beneath the club name', () => {
        renderTree([
            makeEntry({ squadId: 11, squadName: 'Creekside U18' }),
            makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
            makeEntry({ id: 3, clubId: 3, clubName: 'Riverside Rovers', displayName: 'Riverside Rovers', seed: 3 }),
        ]);
        expect(screen.getByText('Creekside U18')).toBeInTheDocument();
    });

    it('swaps same-fixture slots in one PATCH participants call', async () => {
        renderTree();
        fireEvent.dragStart(screen.getByText('Creekside FC'), { dataTransfer: transfer });
        fireEvent.drop(screen.getByText('Metro United'), { dataTransfer: transfer });
        await waitFor(() => expect(updateFixtureParticipants).toHaveBeenCalled());
        expect(updateFixtureParticipants).toHaveBeenCalledWith(1, 10, {
            homeEntryId: 2,
            awayEntryId: 1,
        });
        expect(moveEntry).not.toHaveBeenCalled();
    });

    it('marks pre-placed later-round squads as predictions', () => {
        renderTree(
            [
                makeEntry(),
                makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
                makeEntry({ id: 3, clubId: 3, clubName: 'Riverside Rovers', displayName: 'Riverside Rovers', seed: 3 }),
            ],
            [
                makeFixture({ id: 10, homeEntryId: 1, awayEntryId: 2, roundNumber: 1, fixtureOrder: 1 }),
                makeFixture({ id: 11, homeEntryId: 3, roundNumber: 1, fixtureOrder: 2 }),
                makeFixture({ id: 12, homeEntryId: 3, roundNumber: 2, fixtureOrder: 1 }),
            ],
        );
        expect(screen.getAllByTitle('tournaments.diagram.predictionHint')).toHaveLength(1);
    });

    it('zooms the bracket with the toolbar buttons', async () => {
        renderTree();
        expect(screen.getByText('100%')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('tournaments.diagram.zoomIn'));
        expect(await screen.findByText('125%')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('tournaments.diagram.zoomOut'));
        expect(await screen.findByText('100%')).toBeInTheDocument();
    });

    it('shows teams only in the pool — players stay out', () => {
        renderTree([
            makeEntry(),
            makeEntry({ id: 2, clubId: 2, clubName: 'Metro United', displayName: 'Metro United', seed: 2 }),
            makeEntry({ id: 3, clubId: null, userId: 9, displayName: 'Free Agent', status: 'ACTIVE', seed: 3 }),
        ]);
        expect(screen.queryByText('Free Agent')).not.toBeInTheDocument();
        expect(screen.getByText('tournaments.diagram.createTeam')).toBeInTheDocument();
    });

    it('pans the canvas by dragging empty space', () => {
        const { container } = renderTree();
        const canvas = container.querySelector('div.relative.overflow-hidden') as HTMLElement;
        expect(canvas).toBeTruthy();
        fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0, button: 0 });
        fireEvent.pointerMove(canvas, { clientX: 120, clientY: 40 });
        fireEvent.pointerUp(canvas);
        const wrapper = container.querySelector('div[style*="translate("]') as HTMLElement;
        expect(wrapper.style.transform).toContain('translate(120px, 40px)');
    });

    it('lists forming teams with an edit entry point (team workspace)', async () => {
        (fetchDraftTeams as ReturnType<typeof vi.fn>).mockResolvedValue([
            { id: 1, name: 'Tbilisi Mix', status: 'FORMING', memberCount: 5, promotedEntryId: null, createdAt: '2026-07-01T00:00:00' },
        ]);
        renderTree();
        expect(await screen.findByText('Tbilisi Mix')).toBeInTheDocument();
        expect(screen.getByText('tournaments.diagram.preparing')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('tournaments.diagram.editDraftTeam'));
        expect(await screen.findByText('tournaments.diagram.sendToBracket')).toBeInTheDocument();
    });
});
