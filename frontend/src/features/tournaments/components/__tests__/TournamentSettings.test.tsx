import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../../i18n';
import { TournamentSettings } from '../TournamentSettings';
import { updateTournament } from '../../api';
import type { TournamentDetail } from '../../domain';

vi.mock('../../api', () => ({ updateTournament: vi.fn() }));

const tournament: TournamentDetail = {
    id: 3, name: 'Community cup', organizerOrganizationId: 8, organizerName: 'Horizon Health',
    participantScope: 'CLUB', visibility: 'PRIVATE', registrationPolicy: 'APPROVAL_ONLY', status: 'PLANNING',
    startDate: '2026-06-02T10:00:00', endDate: '2026-06-03T19:00:00',
    registrationOpensAt: '2026-05-01T10:00:00', registrationClosesAt: '2026-06-01T10:00:00',
    description: 'A local tournament', rules: 'Five a side', incentives: 'A trophy', bannerImageUrl: 'https://example.com/cover.jpg',
    entries: [], stages: [], fixtures: [], staffAssignments: [],
};
const renderSettings = () => {
    const Harness = () => {
        const [value, setValue] = useState(tournament);
        return <TournamentSettings tournament={value} onUpdate={setValue} />;
    };
    return render(<Harness />);
};

describe('Tournament settings', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(updateTournament).mockImplementation(async (_id, payload) => ({
            ...tournament, ...payload,
            registrationOpensAt: payload.clearRegistrationOpensAt ? null : payload.registrationOpensAt ?? tournament.registrationOpensAt,
            registrationClosesAt: payload.clearRegistrationClosesAt ? null : payload.registrationClosesAt ?? tournament.registrationClosesAt,
        } as TournamentDetail));
    });

    it('saves visibility and policy changes without overwriting unrelated fields or historic dates', async () => {
        const user = userEvent.setup();
        renderSettings();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        await user.selectOptions(screen.getByRole('combobox', { name: /^Visibility/ }), 'UNLISTED');
        await user.selectOptions(screen.getByRole('combobox', { name: /^How can participants join/ }), 'INVITE_ONLY');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(updateTournament).toHaveBeenCalledWith(3, { visibility: 'UNLISTED', registrationPolicy: 'INVITE_ONLY' });
        expect(screen.getByRole('status')).toHaveTextContent('Tournament details saved.');
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('clears optional text with blank strings and registration dates with explicit flags', async () => {
        const user = userEvent.setup();
        renderSettings();
        await user.clear(screen.getByRole('textbox', { name: 'About the tournament' }));
        await user.click(screen.getByText('Dates and registration window'));
        fireEvent.change(screen.getByLabelText('Registration opens'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('Registration closes'), { target: { value: '' } });
        await user.click(screen.getByText('Rules, prizes, and cover image'));
        await user.clear(screen.getByRole('textbox', { name: 'Rules' }));
        await user.clear(screen.getByRole('textbox', { name: 'Prizes and rewards' }));
        await user.click(screen.getByRole('button', { name: 'Remove cover image 1' }));
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(updateTournament).toHaveBeenCalledWith(3, {
            description: '', rules: '', incentives: '', bannerImageUrl: '',
            clearRegistrationOpensAt: true, clearRegistrationClosesAt: true,
        });
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    it('keeps local edits while adopting untouched fields from a workspace refresh', async () => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const view = render(<TournamentSettings tournament={tournament} onUpdate={onUpdate} />);
        await user.clear(screen.getByRole('textbox', { name: 'Tournament name' }));
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), 'My unfinished title');
        view.rerender(<TournamentSettings tournament={{ ...tournament, description: 'Updated on the server', visibility: 'PUBLIC' }} onUpdate={onUpdate} />);
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('My unfinished title');
        expect(screen.getByRole('textbox', { name: 'About the tournament' })).toHaveValue('Updated on the server');
        expect(screen.getByRole('combobox', { name: /^Visibility/ })).toHaveValue('PUBLIC');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(updateTournament).toHaveBeenCalledWith(3, { name: 'My unfinished title' });
    });

    it('reveals invalid dates inside a closed disclosure and keeps them editable', async () => {
        const user = userEvent.setup();
        renderSettings();
        await user.click(screen.getByText('Dates and registration window'));
        fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-05-30T12:00' } });
        await user.click(screen.getByText('Dates and registration window'));
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(screen.getByRole('alert')).toHaveTextContent('The tournament must end on or after it starts.');
        expect(screen.getByLabelText('Ends').closest('details')).toHaveAttribute('open');
        expect(screen.getByLabelText('Ends')).toHaveFocus();
        expect(updateTournament).not.toHaveBeenCalled();
    });

    it('keeps a failed draft and blocks duplicate saves', async () => {
        let reject!: (reason: Error) => void;
        vi.mocked(updateTournament).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; }));
        const user = userEvent.setup();
        renderSettings();
        await user.clear(screen.getByRole('textbox', { name: 'Tournament name' }));
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), 'Keep this title');
        await user.dblClick(screen.getByRole('button', { name: 'Save changes' }));
        expect(updateTournament).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toBeDisabled();
        await act(async () => reject(new Error('Offline')));
        expect(screen.getByRole('alert')).toHaveTextContent('Your changes have been kept.');
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('Keep this title');
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    it('does not update a different tournament after navigating away while saving', async () => {
        let finish!: (value: TournamentDetail) => void;
        vi.mocked(updateTournament).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const view = render(<TournamentSettings tournament={tournament} onUpdate={onUpdate} />);
        await user.type(screen.getByRole('textbox', { name: 'Tournament name' }), ' edited');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        view.rerender(<TournamentSettings tournament={{ ...tournament, id: 4, name: 'Another tournament' }} onUpdate={onUpdate} />);
        await act(async () => finish({ ...tournament, name: 'Saved old tournament' }));
        expect(onUpdate).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toHaveValue('Another tournament');
    });

    it.each(['ACTIVE', 'COMPLETED', 'CANCELLED'] as const)('keeps settings read-only for a %s tournament', async status => {
        const user = userEvent.setup();
        render(<TournamentSettings tournament={{ ...tournament, status }} onUpdate={vi.fn()} />);
        expect(screen.getByText(/These details are locked/)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Tournament name' })).toBeDisabled();
        expect(screen.getByRole('combobox', { name: /^Visibility/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(updateTournament).not.toHaveBeenCalled();
    });
});
