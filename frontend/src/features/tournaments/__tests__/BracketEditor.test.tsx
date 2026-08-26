import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BracketEditor } from '../components/BracketEditor';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto, TournamentStageDto } from '../domain';

vi.mock('../api', () => ({
    addDraftTeamFakeMember: vi.fn(),
    addDraftTeamMembers: vi.fn(),
    cancelFixture: vi.fn(),
    completeFixture: vi.fn(),
    createDraftTeam: vi.fn(),
    createFixture: vi.fn(),
    createStage: vi.fn(),
    disbandDraftTeam: vi.fn(),
    fetchDraftTeam: vi.fn(),
    fetchDraftTeams: vi.fn(),
    moveEntry: vi.fn(),
    promoteDraftTeam: vi.fn(),
    randomizeStageBracket: vi.fn(),
    removeDraftTeamFakeMember: vi.fn(),
    removeDraftTeamMember: vi.fn(),
    reopenFixture: vi.fn(),
    replaceEntry: vi.fn(),
    updateEntrySquad: vi.fn(),
    updateFixtureParticipants: vi.fn(),
    updateFixtureScores: vi.fn(),
    fetchGroupStandings: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../utils/apiError', () => ({
    extractApiErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import {
    completeFixture,
    createFixture,
    createStage,
    fetchDraftTeams,
    fetchGroupStandings,
} from '../api';

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

const makeStage = (overrides: Partial<TournamentStageDto> = {}): TournamentStageDto => ({
    id: 1,
    parentStageId: null,
    name: 'Knockout',
    stageType: 'KNOCKOUT',
    stageOrder: 1,
    status: 'PLANNING',
    advanceCount: null,
    ...overrides,
});

const makeFixture = (overrides: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id: 1,
    stageId: 1,
    stageName: 'Knockout',
    homeEntryId: 1,
    homeLabel: null,
    awayEntryId: 2,
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

const makeTournament = (overrides: Partial<TournamentDetail> = {}): TournamentDetail => ({
    id: 1,
    name: 'Summer Cup',
    status: 'PLANNING',
    organizerOrganizationId: 1,
    participantScope: 'CLUB',
    visibility: 'PUBLIC',
    staffAssignments: [],
    entries: [makeEntry(), makeEntry({ id: 2, clubName: 'Metro United', displayName: 'Metro United' })],
    stages: [makeStage()],
    fixtures: [],
    ...overrides,
});

const renderEditor = (tournament: TournamentDetail, onRefresh: () => void = () => {}) =>
    render(
        <MemoryRouter>
            <BracketEditor tournamentId={1} tournament={tournament} canManage={true} onRefresh={onRefresh} />
        </MemoryRouter>,
    );

describe('BracketEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (completeFixture as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (createFixture as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (createStage as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (fetchDraftTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (fetchGroupStandings as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    });

    it('renders an empty knockout stage without generate/randomize (teams-only, P7)', () => {
        renderEditor(makeTournament());
        expect(screen.queryByText('tournaments.bracket.generate')).not.toBeInTheDocument();
        expect(screen.queryByText('tournaments.bracket.randomize')).not.toBeInTheDocument();
        expect(screen.getByText('tournaments.bracket.addFixture')).toBeInTheDocument();
        expect(screen.getByText('tournaments.bracket.noFixtures')).toBeInTheDocument();
    });

    it('offers randomize for empty group stages only', async () => {
        renderEditor(makeTournament({ stages: [makeStage({ stageType: 'GROUP', name: 'Group A' })] }));
        expect(screen.queryByText('tournaments.bracket.generate')).not.toBeInTheDocument();
        expect(screen.getByText('tournaments.bracket.randomize')).toBeInTheDocument();
        await screen.findByText('tournaments.standings.empty');
    });

    it('groups knockout fixtures into rounds and renders BYE / winner placeholders', () => {
        const knockoutStage = makeStage({ id: 3, name: 'Knockout' });
        renderEditor(
            makeTournament({
                entries: [
                    makeEntry(),
                    makeEntry({ id: 2, clubName: 'Metro United', displayName: 'Metro United' }),
                    makeEntry({ id: 3, clubName: 'Riverside Rovers', displayName: 'Riverside Rovers' }),
                ],
                stages: [knockoutStage],
                fixtures: [
                    makeFixture({ id: 2, stageId: 3, homeEntryId: 1, awayEntryId: null, roundNumber: 1, fixtureOrder: 1 }),
                    makeFixture({ id: 3, stageId: 3, homeEntryId: 2, awayEntryId: 3, roundNumber: 1, fixtureOrder: 2 }),
                    makeFixture({ id: 4, stageId: 3, homeEntryId: null, awayEntryId: null, roundNumber: 2, fixtureOrder: 1 }),
                ],
            }),
        );
        expect(screen.getAllByText('tournaments.bracket.round')).toHaveLength(2);
        expect(screen.getAllByText('tournaments.diagram.dropHere')).toHaveLength(1);
        expect(screen.getAllByText('tournaments.bracket.winnerOf')).toHaveLength(2);
        // P6: the shell owns this bracket — manual add-fixture is hidden.
        expect(screen.queryByText('tournaments.bracket.addFixture')).not.toBeInTheDocument();
    });

    it('renders the champion banner when a champion is set', () => {
        renderEditor(
            makeTournament({ championEntryId: 2, championName: 'Metro United' }),
        );
        expect(screen.getByText(/tournaments\.bracket\.champion/)).toBeInTheDocument();
        expect(screen.getByText(/Metro United/)).toBeInTheDocument();
    });

    it('completes a group-stage fixture as a draw (no winner)', async () => {
        const user = userEvent.setup();
        (completeFixture as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderEditor(
            makeTournament({
                stages: [makeStage({ id: 1, name: 'Group A', stageType: 'GROUP' })],
                fixtures: [makeFixture({ stageId: 1 })],
            }),
        );
        await user.click(screen.getByTitle('Force complete'));
        expect(screen.getByText('tournaments.bracket.draw')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Force Complete' }));
        expect(completeFixture).toHaveBeenCalledWith(1, 1, {
            winnerEntryId: null,
            homeScore: null,
            awayScore: null,
        });
    });

    it('requires a winner for knockout fixtures and defaults it to home', async () => {
        const user = userEvent.setup();
        (completeFixture as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderEditor(
            makeTournament({
                stages: [makeStage({ id: 1, name: 'Knockout', stageType: 'KNOCKOUT' })],
                fixtures: [makeFixture({ stageId: 1 })],
            }),
        );
        await user.click(screen.getByTitle('Force complete'));
        expect(screen.queryByText('tournaments.bracket.draw')).not.toBeInTheDocument();
        expect(screen.getByText('Select winner...')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Force Complete' }));
        expect(completeFixture).toHaveBeenCalledWith(1, 1, {
            winnerEntryId: 1,
            homeScore: null,
            awayScore: null,
        });
    });

    it('renders the standings table for group stages with entry-status badges', async () => {
        (fetchGroupStandings as ReturnType<typeof vi.fn>).mockResolvedValue([
            { entryId: 1, entryName: 'Creekside FC', entryType: 'CLUB', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: 2, points: 3 },
            { entryId: 2, entryName: 'Metro United', entryType: 'CLUB', played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2, goalDifference: -2, points: 0 },
        ]);
        renderEditor(
            makeTournament({
                entries: [
                    makeEntry(),
                    makeEntry({ id: 2, clubName: 'Metro United', displayName: 'Metro United', status: 'ELIMINATED' }),
                ],
                stages: [makeStage({ id: 1, name: 'Group A', stageType: 'GROUP' })],
                fixtures: [makeFixture({ stageId: 1 })],
            }),
        );
        expect(await screen.findByText('tournaments.standings.title')).toBeInTheDocument();
        // Badge shows in both the fixture row and the standings row for the eliminated entry.
        expect(screen.getAllByText('ELIMINATED')).toHaveLength(2);
        expect(fetchGroupStandings).toHaveBeenCalledWith(1, 1);
    });

    it('creates a stage through the new-stage form', async () => {
        const user = userEvent.setup();
        (createStage as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderEditor(makeTournament());
        await user.click(screen.getByText('tournaments.stages.newStage'));
        await user.type(screen.getByLabelText('tournaments.stages.name'), 'Semi Final');
        await user.click(screen.getByText('tournaments.stages.create'));
        expect(createStage).toHaveBeenCalledWith(1, {
            name: 'Semi Final',
            stageType: 'GROUP',
            stageOrder: 2,
            advanceCount: null,
            bracketSize: null,
        });
    });

    it('rejects a stage without a name', async () => {
        const user = userEvent.setup();
        renderEditor(makeTournament());
        await user.click(screen.getByText('tournaments.stages.newStage'));
        await user.click(screen.getByText('tournaments.stages.create'));
        expect(createStage).not.toHaveBeenCalled();
        expect(screen.getByText('tournaments.stages.nameRequired')).toBeInTheDocument();
    });

    it('adds a Spots control for knockout stages and sends the chosen size', async () => {
        const user = userEvent.setup();
        (createStage as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderEditor(makeTournament());
        await user.click(screen.getByText('tournaments.stages.newStage'));
        await user.type(screen.getByLabelText('tournaments.stages.name'), 'Finals');
        await user.selectOptions(screen.getByLabelText('tournaments.stages.type'), 'KNOCKOUT');
        expect(screen.getByLabelText('tournaments.stages.spots')).toBeInTheDocument();
        await user.selectOptions(screen.getByLabelText('tournaments.stages.spots'), '16');
        await user.click(screen.getByText('tournaments.stages.create'));
        expect(createStage).toHaveBeenCalledWith(1, {
            name: 'Finals',
            stageType: 'KNOCKOUT',
            stageOrder: 2,
            advanceCount: null,
            bracketSize: 16,
        });
    });

    it('creates a fixture through the inline form with computed defaults', async () => {
        const user = userEvent.setup();
        (createFixture as ReturnType<typeof vi.fn>).mockResolvedValue({});
        renderEditor(makeTournament({ stages: [makeStage({ id: 5 })] }));
        await user.click(screen.getByText('tournaments.bracket.addFixture'));
        await user.click(screen.getByText('tournaments.bracket.create'));
        expect(createFixture).toHaveBeenCalledWith(1, 5, {
            homeEntryId: null,
            awayEntryId: null,
            roundNumber: 1,
            fixtureOrder: 1,
            scheduledAt: null,
            locationId: null,
        });
    });
});
