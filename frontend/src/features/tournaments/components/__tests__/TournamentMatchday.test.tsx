import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import '../../../../i18n';
import { TournamentMatchday } from '../TournamentMatchday';
import { TournamentMatchDialog } from '../TournamentMatchDialog';
import { scheduleTournamentFixture } from '../../api';
import type { TournamentDetail, TournamentEntryDto, TournamentFixtureDto } from '../../domain';

vi.mock('../../api', () => ({ scheduleTournamentFixture: vi.fn(), cancelFixture: vi.fn(), completeFixture: vi.fn(), reopenFixture: vi.fn(), updateFixtureScores: vi.fn() }));

const entry = (id: number, name: string): TournamentEntryDto => ({
    id, clubId: id, clubName: name, squadId: id, squadName: null, userId: null, displayName: null,
    status: 'ACTIVE', seed: null, requestedBy: null, decidedBy: null, decidedAt: null,
    confirmedAt: null, withdrawnAt: null, withdrawalReason: null,
});
const fixture = (id: number, extra: Partial<TournamentFixtureDto> = {}): TournamentFixtureDto => ({
    id, stageId: 1, stageName: 'Group A', homeEntryId: 1, awayEntryId: 2,
    homeLabel: null, awayLabel: null, winnerEntryId: null, homeScore: null, awayScore: null,
    roundNumber: 1, fixtureOrder: id, scheduledAt: '2027-06-10T10:00:00', locationId: null,
    status: 'SCHEDULED', linkedMatchId: null, ...extra,
});
const tournament: TournamentDetail = {
    id: 1, name: 'Academy cup', status: 'PLANNING', organizerOrganizationId: 1,
    participantScope: 'SQUAD', visibility: 'PUBLIC', staffAssignments: [],
    entries: [entry(1, 'Riverside U12'), entry(2, 'Dinamo U12'), entry(3, 'Coastal U12')],
    stages: [{ id: 1, name: 'Group A', parentStageId: null, stageType: 'GROUP', stageOrder: 1, status: 'PLANNING', advanceCount: null }],
    fixtures: [fixture(1), fixture(2, { awayEntryId: 3 }), fixture(3, { scheduledAt: null }), fixture(4, { scheduledAt: '2027-06-11T12:00:00', status: 'COMPLETED', homeScore: 2, awayScore: 1 })],
};

function MatchdayFlow({ canManage = true }: { canManage?: boolean }) {
    const [value, setValue] = useState(tournament);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = value.fixtures.find(item => item.id === selectedId);
    return <><TournamentMatchday tournament={value} active onMatch={item => setSelectedId(item.id)} onBracket={vi.fn()}/>
        {selected && <TournamentMatchDialog tournament={value} fixture={selected} canManage={canManage} canScore={canManage} onUpdate={setValue} onClose={() => setSelectedId(null)}/>}</>;
}

describe('Tournament matchday workspace', () => {
    beforeEach(() => vi.clearAllMocks());

    it('saves through the existing match editor and immediately moves the match to its new day', async () => {
        const user = userEvent.setup();
        vi.mocked(scheduleTournamentFixture).mockResolvedValueOnce({ ...tournament, fixtures: tournament.fixtures.map(item => item.id === 2 ? { ...item, scheduledAt: '2027-06-12T15:30:00' } : item) });
        render(<MatchdayFlow/>);
        await user.click(screen.getByRole('button', { name: 'Open match: Riverside U12 / Coastal U12' }));
        fireEvent.change(screen.getByLabelText('Kickoff', { exact: true }), { target: { value: '2027-06-12T15:30' } });
        await user.click(screen.getByRole('button', { name: 'Save kickoff' }));
        expect(await screen.findByText('Match updated.')).toBeVisible();
        expect(scheduleTournamentFixture).toHaveBeenCalledWith(1, 2, '2027-06-12T15:30:00', null);
        await user.click(screen.getByRole('button', { name: 'Close' }));
        const newDay = screen.getByRole('region', { name: 'Sat, 12 June 2027' });
        expect(within(newDay).getByText('15:30')).toBeVisible();
        expect(within(newDay).getByText('Coastal U12')).toBeVisible();
        expect(screen.queryByText('Team scheduled twice at this time')).not.toBeInTheDocument();
    });

    it('keeps the old schedule and the entered correction when the server rejects an edit', async () => {
        const user = userEvent.setup();
        vi.mocked(scheduleTournamentFixture).mockRejectedValueOnce(new Error('Conflict'));
        render(<MatchdayFlow/>);
        await user.click(screen.getByRole('button', { name: 'Open match: Riverside U12 / Coastal U12' }));
        fireEvent.change(screen.getByLabelText('Kickoff', { exact: true }), { target: { value: '2027-06-12T15:30' } });
        await user.click(screen.getByRole('button', { name: 'Save kickoff' }));
        expect(await screen.findByRole('alert')).toBeVisible();
        expect(screen.getByLabelText('Kickoff', { exact: true })).toHaveValue('2027-06-12T15:30');
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('region', { name: 'Sat, 12 June 2027' })).not.toBeInTheDocument();
        expect(screen.getAllByText('Team scheduled twice at this time')[0]).toBeVisible();
    });

    it('preserves read-only access when opening a match from the schedule', async () => {
        render(<MatchdayFlow canManage={false}/>);
        await userEvent.click(screen.getByRole('button', { name: 'Open match: Riverside U12 / Coastal U12' }));
        expect(screen.getByRole('dialog')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Save kickoff' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save score' })).not.toBeInTheDocument();
        expect(scheduleTournamentFixture).not.toHaveBeenCalled();
    });

    it('filters by team and day while keeping clashes against hidden opponents visible', async () => {
        const user = userEvent.setup();
        render(<TournamentMatchday tournament={tournament} active onMatch={vi.fn()} onBracket={vi.fn()}/>);
        await user.selectOptions(screen.getByLabelText('Team'), '3');
        expect(screen.getByRole('status')).toHaveTextContent('1 of 4 matches');
        expect(screen.getByText('Team scheduled twice at this time')).toBeVisible();
        await user.selectOptions(screen.getByLabelText('Day'), '2027-06-11');
        expect(screen.getByRole('heading', { name: 'No matches in this view' })).toBeVisible();
        await user.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(screen.getByRole('status')).toHaveTextContent('4 of 4 matches');
    });

    it('opens the existing fixture and updates warnings when the edited tournament arrives', async () => {
        const user = userEvent.setup();
        const onMatch = vi.fn();
        const { rerender } = render(<TournamentMatchday tournament={tournament} active onMatch={onMatch} onBracket={vi.fn()}/>);
        await user.click(screen.getByRole('button', { name: 'Open match: Riverside U12 / Coastal U12' }));
        expect(onMatch).toHaveBeenCalledWith(tournament.fixtures[1]);
        await user.click(screen.getByRole('button', { name: 'Needs attention' }));
        expect(screen.getByRole('status')).toHaveTextContent('3 of 4 matches');
        rerender(<TournamentMatchday tournament={{ ...tournament, fixtures: tournament.fixtures.map(item => item.id === 2 ? { ...item, scheduledAt: '2027-06-10T12:00:00' } : item) }} active onMatch={onMatch} onBracket={vi.fn()}/>);
        expect(screen.getByRole('status')).toHaveTextContent('1 of 4 matches');
        expect(screen.queryByText('Team scheduled twice at this time')).not.toBeInTheDocument();
    });

    it('prints only the filtered view and removes the print document on leaving the tab', () => {
        const print = vi.spyOn(window, 'print').mockImplementation(() => {});
        const { rerender } = render(<TournamentMatchday tournament={tournament} active onMatch={vi.fn()} onBracket={vi.fn()}/>);
        fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2027-06-11' } });
        fireEvent.click(screen.getByRole('button', { name: 'Print schedule' }));
        expect(print).toHaveBeenCalledOnce();
        const printed = document.querySelector('.tw-matchday-print') as HTMLElement;
        expect(printed).toHaveTextContent('Riverside U12 2 – 1 Dinamo U12');
        expect(printed).not.toHaveTextContent('Coastal U12');
        expect(within(printed).getAllByRole('row', { hidden: true })).toHaveLength(2);
        rerender(<TournamentMatchday tournament={tournament} active={false} onMatch={vi.fn()} onBracket={vi.fn()}/>);
        expect(document.querySelector('.tw-matchday-print')).toBeNull();
        print.mockRestore();
    });

    it('keeps cancelled fixtures out of attention checks and preserves progression labels', async () => {
        const user = userEvent.setup();
        render(<TournamentMatchday tournament={{ ...tournament, fixtures: [fixture(1, { scheduledAt: null, status: 'CANCELLED', homeEntryId: null, homeLabel: 'Winner of Group A', awayEntryId: null, awayLabel: null })] }} active onMatch={vi.fn()} onBracket={vi.fn()}/>);
        expect(screen.getByRole('button', { name: 'Open match: Winner of Group A / To be decided' })).toBeVisible();
        await user.click(screen.getByRole('button', { name: 'Needs attention' }));
        expect(screen.getByRole('status')).toHaveTextContent('0 of 1 matches');
        expect(screen.getByRole('button', { name: 'Print schedule' })).toBeDisabled();
    });

    it('offers a route to the competition when no fixtures exist', async () => {
        const onBracket = vi.fn();
        render(<TournamentMatchday tournament={{ ...tournament, fixtures: [] }} active onMatch={vi.fn()} onBracket={onBracket}/>);
        await userEvent.click(screen.getByRole('button', { name: 'Open competition' }));
        expect(onBracket).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: 'Print schedule' })).toBeDisabled();
    });
});
