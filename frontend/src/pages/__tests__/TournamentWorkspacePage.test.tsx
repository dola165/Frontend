import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../i18n';
import { TournamentWorkspacePage } from '../TournamentWorkspacePage';
import { getTournamentStartBlockers } from '../../features/tournaments/startBlockers';
import { useAuth } from '../../context/AuthContext';
import { fetchTournament, updateTournament } from '../../features/tournaments/api';
import type { TournamentDetail } from '../../features/tournaments/domain';
import {getCompetitionProfile} from '../../features/competitions/api';
vi.mock('../../features/competitions/api',()=>({getCompetitionProfile:vi.fn()}));
vi.mock('../../features/competitions/CompetitionOperationsPanel',()=>({CompetitionOperationsPanel:()=>null}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../features/tournaments/api', () => ({ fetchTournament: vi.fn(), updateTournament: vi.fn(), startTournament: vi.fn(), finishTournament: vi.fn() }));
vi.mock('../../features/tournaments/components/TournamentParticipants', () => ({ TournamentParticipants: () => <div>Participant list</div> }));
vi.mock('../../features/tournaments/components/TournamentCompetition', () => ({ TournamentCompetition: ({ canScore, onTieStateChange }: { canScore?: boolean; onTieStateChange?: (state: unknown) => void }) => <div>Competition content <span>{canScore ? 'Scoring enabled' : 'View only'}</span><button onClick={() => onTieStateChange?.({ blocked: true, staleStageIds: [], blockedStageIds: [], contests: [{ status: 'UNRESOLVED', consequential: true }] })}>Simulate blocked tie</button></div> }));
vi.mock('../../features/tournaments/components/TournamentMatchDialog', () => ({ TournamentMatchDialog: () => <div>Match dialog</div> }));

const tournament: TournamentDetail = {
    id: 3, name: 'Community cup', organizerOrganizationId: 8, organizerName: 'Horizon Health',
    participantScope: 'CLUB', visibility: 'PRIVATE', registrationPolicy: 'APPROVAL_ONLY', status: 'PLANNING',
    startDate: '2099-06-02T10:00:00', endDate: '2099-06-03T19:00:00', entries: [], fixtures: [], stages: [],
    staffAssignments: [{ id: 9, userId: 17, fullName: 'Organizer', role: 'ADMIN', status: 'ACTIVE', assignedBy: 17, createdAt: '2026-09-15T00:00:00' }],
};
function renderWorkspace(path = '/tournaments/3/workspace') {
    return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/tournaments/:tournamentId/workspace" element={<TournamentWorkspacePage />} /></Routes></MemoryRouter>);
}

describe('Tournament workspace navigation and editor', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(getCompetitionProfile).mockResolvedValue({rules:null,revision:0,legacy:true});
        vi.mocked(useAuth).mockReturnValue({ user: { id: 17 }, isAuthenticated: true } as ReturnType<typeof useAuth>);
        vi.mocked(fetchTournament).mockResolvedValue(tournament);
        vi.mocked(updateTournament).mockImplementation(async (_id, payload) => ({ ...tournament, ...payload } as TournamentDetail));
    });

    it('opens a direct matchday link', async () => {
        renderWorkspace('/tournaments/3/workspace?view=schedule');
        const navigation = await screen.findByRole('navigation', { name: 'Tournament workspace sections' });
        expect(within(navigation).getByRole('button', { name: 'Matchday' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('heading', { name: 'Every match. One schedule.' })).toBeVisible();
    });

    it('opens the matchday schedule from setup guidance and links back to Competition', async () => {
        const user = userEvent.setup();
        renderWorkspace();
        const navigation = await screen.findByRole('navigation', { name: 'Tournament workspace sections' });
        expect(within(navigation).getAllByRole('button')).toHaveLength(5);
        expect(within(navigation).getByRole('button', { name: /^Participants/ })).toBeInTheDocument();
        expect(within(navigation).getByRole('button', { name: 'Competition' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Matches & results/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Match schedule.*Set times/ }));
        expect(within(navigation).getByRole('button', { name: 'Matchday' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('heading', { name: 'Every match. One schedule.' })).toBeVisible();
        await user.click(screen.getAllByRole('button', { name: 'Open competition' })[0]);
        expect(within(navigation).getByRole('button', { name: 'Competition' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('Scoring enabled')).toBeVisible();
    });

    it('does not advertise frontend-only volunteer shifts or tournament series', async () => {
        renderWorkspace();
        await screen.findByRole('heading', { name: 'Community cup' });
        expect(screen.queryByRole('link', { name: /Volunteer shifts/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Competition series/)).not.toBeInTheDocument();
    });

    it('preserves unfinished edits through close and reopen and restores focus', async () => {
        const user = userEvent.setup();
        renderWorkspace();
        const opener = await screen.findByRole('button', { name: 'Edit tournament' });
        await user.click(opener);
        expect(screen.getByRole('dialog', { name: 'Edit tournament' })).toBeInTheDocument();
        await user.clear(screen.getByRole('textbox', { name: 'Tournament name' }));
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), 'Unfinished title');
        await user.click(screen.getByRole('button', { name: 'Close tournament editor' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(opener).toHaveFocus();
        await user.click(opener);
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('Unfinished title');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(updateTournament).not.toHaveBeenCalled();
    });

    it('blocks dismissal while saving and updates the tournament heading after the save', async () => {
        let finish!: (value: TournamentDetail) => void;
        vi.mocked(updateTournament).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const user = userEvent.setup();
        renderWorkspace();
        await user.click(await screen.findByRole('button', { name: 'Edit tournament' }));
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), ' edited');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(screen.getByRole('button', { name: 'Close tournament editor' })).toBeDisabled();
        await user.keyboard('{Escape}');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('dialog').parentElement!);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await act(async () => finish({ ...tournament, name: 'Community cup edited' }));
        expect(screen.getByRole('button', { name: 'Close tournament editor' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Close tournament editor' }));
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Community cup edited');
    });

    it.each([
        ['STAFF', 'ACTIVE', true],
        ['REFEREE', 'ACTIVE', false],
        ['STAFF', 'INACTIVE', false],
    ] as const)('matches backend scoring access for %s with %s assignment', async (role, status, canScore) => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...tournament, staffAssignments: [{ ...tournament.staffAssignments[0], role, status }] });
        const user = userEvent.setup();
        renderWorkspace();
        await user.click(await screen.findByRole('button', { name: 'Competition' }));
        expect(screen.getByText(canScore ? 'Scoring enabled' : 'View only')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Edit tournament' })).not.toBeInTheDocument();
    });

    it('explains every visible start blocker beside the disabled control and links to the relevant section', async () => {
        const user = userEvent.setup();
        renderWorkspace();
        const start = await screen.findByRole('button', { name: 'Start tournament' });
        expect(start).toBeDisabled();
        expect(start).toHaveAttribute('aria-describedby', 'tournament-start-blockers');
        expect(screen.getByText('Add at least one competition stage.')).toBeInTheDocument();
        expect(screen.getByText('Add at least one match to the competition.')).toBeInTheDocument();
        expect(screen.getByText('Confirm at least two active teams.')).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', { name: 'Open Competition' })[0]);
        expect(screen.getByRole('button', { name: 'Competition' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('blocks completion and explains the authoritative tie state in the workspace', async () => {
        vi.mocked(fetchTournament).mockResolvedValue({ ...tournament, status: 'ACTIVE' });
        const user = userEvent.setup();
        renderWorkspace('/tournaments/3/workspace?view=bracket');
        await user.click(await screen.findByRole('button', { name: 'Simulate blocked tie' }));
        expect(screen.getByRole('button', { name: 'Finish tournament' })).toBeDisabled();
        expect(screen.getByText('Competition progression is blocked')).toBeInTheDocument();
        expect(screen.getByText(/consequential tie needs an authoritative decision/)).toBeInTheDocument();
    });
});

it('derives registration, placement, date and venue-conflict start blockers from authoritative tournament state', () => {
    const entry = (id: number) => ({ id, clubId: id, clubName: `Club ${id}`, squadId: null, squadName: null, userId: null, displayName: null, status: 'ACTIVE' as const, seed: null, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null, withdrawnAt: null, withdrawalReason: null });
    const fixture = (id: number, scheduledAt: string, locationId: number) => ({ id, stageId: 1, stageName: 'League', homeEntryId: id, homeLabel: `Club ${id}`, awayEntryId: id + 1, awayLabel: `Club ${id + 1}`, winnerEntryId: null, homeScore: null, awayScore: null, roundNumber: 1, fixtureOrder: id, scheduledAt, locationId, status: 'SCHEDULED' as const, linkedMatchId: null });
    const blockers = getTournamentStartBlockers({ ...tournament,
        registrationOpensAt: '2099-05-01T00:00:00', registrationClosesAt: '2099-05-20T00:00:00',
        entries: [entry(1), entry(2), entry(3), entry(10)], stages: [{ id: 1, parentStageId: null, name: 'League', stageType: 'ROUND_ROBIN', stageOrder: 1, status: 'PLANNING', advanceCount: null }],
        fixtures: [fixture(1, '2099-06-01T10:00:00', 7), fixture(2, '2099-06-01T11:00:00', 7), fixture(4, '2099-06-04T10:00:00', 8)],
    }, new Date('2099-04-01T00:00:00'));
    expect(blockers.map(blocker => blocker.key)).toEqual(expect.arrayContaining(['registration-opens', 'registration-closes', 'placement', 'before-start', 'after-end', 'venue-conflict']));
});
