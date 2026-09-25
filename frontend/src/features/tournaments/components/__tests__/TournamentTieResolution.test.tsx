import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../../i18n';
import { TournamentTieBlockerBanner, TournamentTieResolution } from '../TournamentTieResolution';
import type { TournamentDetail, TournamentTieDecision, TournamentTieState } from '../../domain';
import { fetchTournamentTieHistory, fetchTournamentTieState, resolveTournamentTie } from '../../api';

vi.mock('../../api', () => ({
    fetchTournamentTieState: vi.fn(),
    fetchTournamentTieHistory: vi.fn(),
    resolveTournamentTie: vi.fn(),
}));

const tournament: TournamentDetail = {
    id: 7, name: 'Community Cup', organizerOrganizationId: 8, organizerName: 'Organizer',
    participantScope: 'CLUB', visibility: 'PUBLIC', status: 'ACTIVE',
    staffAssignments: [{ id: 1, userId: 44, fullName: 'Alex Operator', role: 'STAFF', status: 'ACTIVE', assignedBy: 1, createdAt: '2026-09-20T10:00:00Z' }],
    entries: [
        { id: 21, clubId: 1, clubName: 'Riverside', squadId: null, squadName: null, userId: null, displayName: null, status: 'ACTIVE', seed: null, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null, withdrawnAt: null, withdrawalReason: null },
        { id: 22, clubId: 2, clubName: 'Hill FC', squadId: null, squadName: null, userId: null, displayName: null, status: 'ACTIVE', seed: null, requestedBy: null, decidedBy: null, decidedAt: null, confirmedAt: null, withdrawnAt: null, withdrawalReason: null },
    ],
    stages: [
        { id: 10, parentStageId: null, name: 'Group A', stageType: 'GROUP', stageOrder: 1, status: 'COMPLETED', advanceCount: 1 },
        { id: 11, parentStageId: 10, name: 'Final', stageType: 'KNOCKOUT', stageOrder: 2, status: 'PLANNING', advanceCount: null },
    ],
    fixtures: [],
};

const unresolved: TournamentTieState = {
    blocked: true, staleStageIds: [], blockedStageIds: [11],
    contests: [{
        key: 'RANK:10:1', stageId: 10, fixtureId: null, rank: 1,
        candidateEntryIds: [21, 22], sourceRevision: '4:7:9',
        ruleContext: 'Win=3; draw=1; loss=0; points DESC, goal difference DESC, goals for DESC.',
        status: 'UNRESOLVED', selectedEntryId: null, resolutionId: null,
        consequential: true, readyForResolution: true,
    }],
};
const resolved: TournamentTieState = {
    blocked: false, staleStageIds: [], blockedStageIds: [],
    contests: [{ ...unresolved.contests[0], status: 'RESOLVED', selectedEntryId: 22, resolutionId: 91 }],
};
const invalidated: TournamentTieDecision = {
    id: 90, key: 'RANK:10:1', stageId: 10, fixtureId: null, candidateEntryIds: [21, 22],
    selectedEntryId: 21, operatorId: 44, decidedAt: '2026-09-20T10:30:00Z', note: 'Witnessed draw',
    ruleContext: unresolved.contests[0].ruleContext, sourceRevision: '4:6:8', submittedRevision: '4:6:8',
    invalidatedAt: '2026-09-20T11:00:00Z', invalidationReason: 'FIXTURE_CHANGED',
};

describe('TournamentTieResolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchTournamentTieState).mockResolvedValue(unresolved);
        vi.mocked(fetchTournamentTieHistory).mockResolvedValue([]);
    });

    it('explains the exact unresolved tie, applied rules, position, contenders, and blocked operation', async () => {
        render(<TournamentTieResolution tournament={tournament} canResolve={false}/>);
        expect(await screen.findByText('Group A · position 1')).toBeInTheDocument();
        expect(screen.getByText(/Riverside/)).toBeInTheDocument();
        expect(screen.getByText(/Hill FC/)).toBeInTheDocument();
        expect(screen.getByText(/Qualification, seeding, and downstream advancement are blocked/)).toBeInTheDocument();
        await userEvent.click(screen.getByText('Sporting rules already applied'));
        expect(screen.getByText(/goal difference DESC/)).toBeInTheDocument();
    });

    it('gives unauthorized viewers a truthful read-only explanation without controls', async () => {
        render(<TournamentTieResolution tournament={tournament} canResolve={false}/>);
        expect(await screen.findByText(/Only tournament ADMIN or STAFF/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Resolve this tie' })).not.toBeInTheDocument();
        expect(fetchTournamentTieHistory).not.toHaveBeenCalled();
    });

    it('requires a candidate and reason, previews the consequence, records, and refreshes downstream state', async () => {
        vi.mocked(resolveTournamentTie).mockResolvedValue(resolved);
        vi.mocked(fetchTournamentTieHistory).mockResolvedValue([]);
        const onResolved = vi.fn();
        const onStateChange = vi.fn();
        render(<TournamentTieResolution tournament={tournament} canResolve onResolved={onResolved} onStateChange={onStateChange}/>);
        const user = userEvent.setup();
        await user.click(await screen.findByRole('button', { name: 'Resolve this tie' }));
        const preview = screen.getByRole('button', { name: 'Preview consequence' });
        expect(preview).toBeDisabled();
        await user.click(screen.getByRole('radio', { name: /Hill FC/ }));
        await user.type(screen.getByRole('textbox', { name: 'Required reason or note' }), 'Documented drawing of lots');
        await user.click(preview);
        expect(screen.getByText('Immediate consequence')).toBeInTheDocument();
        expect(screen.getByText(/immediately retry the affected advancement/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
        await waitFor(() => expect(resolveTournamentTie).toHaveBeenCalledWith(7, unresolved.contests[0], 22, 'Documented drawing of lots'));
        expect(onResolved).toHaveBeenCalledOnce();
        expect(onStateChange).toHaveBeenCalledWith(resolved);
    });

    it('keeps the operator draft and refetches authoritative state after a stale revision', async () => {
        vi.mocked(resolveTournamentTie).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
        vi.mocked(fetchTournamentTieState).mockResolvedValueOnce(unresolved).mockResolvedValueOnce({ ...unresolved, contests: [{ ...unresolved.contests[0], sourceRevision: '4:8:10' }] });
        render(<TournamentTieResolution tournament={tournament} canResolve/>);
        const user = userEvent.setup();
        await user.click(await screen.findByRole('button', { name: 'Resolve this tie' }));
        await user.click(screen.getByRole('radio', { name: /Riverside/ }));
        await user.type(screen.getByRole('textbox', { name: 'Required reason or note' }), 'Referee report attached');
        await user.click(screen.getByRole('button', { name: 'Preview consequence' }));
        await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
        expect(await screen.findByText(/selection and reason are still here/)).toBeInTheDocument();
        expect(screen.getByText('Referee report attached')).toBeInTheDocument();
        expect(fetchTournamentTieState).toHaveBeenCalledTimes(2);
    });

    it('shows resolved and invalidated audit context with operator, note, rule context, and revisions', async () => {
        vi.mocked(fetchTournamentTieState).mockResolvedValue(resolved);
        vi.mocked(fetchTournamentTieHistory).mockResolvedValue([invalidated, { ...invalidated, id: 91, selectedEntryId: 22, note: 'Current ruling', sourceRevision: '4:7:9', submittedRevision: '4:7:9', invalidatedAt: null, invalidationReason: null }]);
        render(<TournamentTieResolution tournament={tournament} canResolve/>);
        expect(await screen.findByText(/Hill FC was selected/)).toBeInTheDocument();
        expect(screen.getByText('Invalidated / superseded')).toBeInTheDocument();
        expect(screen.getByText(/A match result or participant changed/)).toBeInTheDocument();
        expect(screen.getAllByText('Alex Operator')).toHaveLength(2);
        expect(screen.getByText(/Current ruling/)).toBeInTheDocument();
        expect(screen.getByText('Tie decisions are current')).toBeInTheDocument();
    });

    const staleDraft = async (next: TournamentTieState | Error) => {
        vi.mocked(resolveTournamentTie).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } }).mockResolvedValue(resolved);
        vi.mocked(fetchTournamentTieState).mockResolvedValueOnce(unresolved);
        if (next instanceof Error) vi.mocked(fetchTournamentTieState).mockRejectedValueOnce(next);
        else vi.mocked(fetchTournamentTieState).mockResolvedValueOnce(next);
        render(<TournamentTieResolution tournament={tournament} canResolve/>);
        const user = userEvent.setup();
        await user.click(await screen.findByRole('button', { name: 'Resolve this tie' }));
        await user.click(screen.getByRole('radio', { name: /Riverside/ }));
        await user.type(screen.getByRole('textbox', { name: 'Required reason or note' }), 'Retained reason');
        await user.click(screen.getByRole('button', { name: 'Preview consequence' }));
        await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
        await screen.findByText(/selection and reason are still here/);
        await waitFor(() => expect(fetchTournamentTieState).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();
        return user;
    };

    it('requires another preview and submits the refreshed contest revision after conflict', async () => {
        const current = { ...unresolved.contests[0], sourceRevision: 'fresh:revision' };
        const user = await staleDraft({ ...unresolved, contests: [current] });
        await user.click(screen.getByRole('button', { name: 'Return to the saved draft' }));
        expect(screen.getByRole('textbox')).toHaveValue('Retained reason');
        expect(screen.getByRole('radio', { name: /Riverside/ })).toBeChecked();
        await user.click(screen.getByRole('button', { name: 'Preview consequence' }));
        await user.click(screen.getByRole('button', { name: 'Confirm decision' }));
        await waitFor(() => expect(resolveTournamentTie).toHaveBeenLastCalledWith(7, current, 21, 'Retained reason'));
    });

    it('clears a selection removed from the refreshed candidate set', async () => {
        const user = await staleDraft({ ...unresolved, contests: [{ ...unresolved.contests[0], sourceRevision: 'new', candidateEntryIds: [22, 23] }] });
        await user.click(screen.getByRole('button', { name: 'Return to the saved draft' }));
        expect(screen.getByRole('button', { name: 'Preview consequence' })).toBeDisabled();
        expect(screen.getByRole('textbox')).toHaveValue('Retained reason');
        expect(screen.queryByRole('radio', { name: /Riverside/ })).not.toBeInTheDocument();
    });

    it.each([resolved, { ...resolved, contests: [] }, { ...unresolved, contests: [{ ...unresolved.contests[0], readyForResolution: false }] }])('keeps an unavailable draft visible without allowing another invalid decision', async next => {
        const user = await staleDraft(next);
        await user.click(screen.getByRole('button', { name: 'Return to the saved draft' }));
        expect(await screen.findByText(/no longer available for a decision/)).toBeVisible();
        expect(screen.getByText('Retained reason')).toBeVisible();
        expect(screen.getByRole('button', { name: 'Confirm decision' })).toBeDisabled();
        expect(resolveTournamentTie).toHaveBeenCalledTimes(1);
    });

    it('requires a successful refresh after failure before returning to the saved draft', async () => {
        const user = await staleDraft(new Error('Offline'));
        await user.click(screen.getByRole('button', { name: 'Retry tie status' }));
        await user.click(await screen.findByRole('button', { name: 'Return to the saved draft' }));
        expect(screen.getByRole('textbox')).toHaveValue('Retained reason');
        expect(resolveTournamentTie).toHaveBeenCalledTimes(1);
    });

    it('presents stale and downstream blocked stages in the completion banner', () => {
        render(<TournamentTieBlockerBanner tournament={tournament} state={{ ...unresolved, contests: [], staleStageIds: [10] }}/>);
        expect(screen.getByText('Competition progression is blocked')).toBeInTheDocument();
        expect(screen.getByText(/Affected: Group A, Final/)).toBeInTheDocument();
    });
});
