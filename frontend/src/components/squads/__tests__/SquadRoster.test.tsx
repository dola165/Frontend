import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SquadRosterGrid } from '../SquadRosterGrid';
import { SquadRosterTable, type SquadRosterGroup } from '../SquadRosterTable';
import { RosterPlayerEditor } from '../squadRosterPresentation';
import '../../../i18n';

vi.mock('../../ui/MediaImage', () => ({ MediaImage: () => null }));
vi.mock('../../workspace/TrialistBadge', () => ({ TrialistBadge: () => <span>Private trial duration</span> }));

const player = {
    id: 12,
    name: 'Nika Tsintsadze',
    number: 12,
    position: 'GOALKEEPER',
    squadRole: 'CAPTAIN',
    age: 14,
    isRegistered: false,
    status: 'TRIALIST',
};
const groups: SquadRosterGroup[] = [{ label: 'Goalkeepers', players: [player] }];

describe('shared squad rosters', () => {
    it.each([SquadRosterGrid, SquadRosterTable])('links registered names and avatars while leaving player cards unlinked', Component => {
        render(<MemoryRouter><Component groups={[{label:'Players',players:[player,{...player,id:55,name:'Registered Player',isRegistered:true}]}]}/></MemoryRouter>);
        expect(screen.getByRole('link',{name:'Registered Player'})).toHaveAttribute('href','/profile/55');
        expect(screen.getByRole('link',{name:"View Registered Player's profile"})).toHaveAttribute('href','/profile/55');
        expect(screen.queryByRole('link',{name:'Nika Tsintsadze'})).not.toBeInTheDocument();
    });
    it.each([
        ['cards', SquadRosterGrid],
        ['roster', SquadRosterTable],
    ] as const)('keeps private management details out of public %s', (_name, Component) => {
        render(<Component groups={groups} />);
        expect(screen.getByText('Nika Tsintsadze')).toBeVisible();
        expect(screen.getByText('Captain')).toBeVisible();
        expect(screen.queryByText('Player card')).not.toBeInTheDocument();
        expect(screen.queryByText('Private trial duration')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Remove|Edit/ })).not.toBeInTheDocument();
        expect(screen.queryByTitle('Available')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Unavailable')).not.toBeInTheDocument();
    });

    it('saves the selected squad role while preserving the shirt number', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(<RosterPlayerEditor player={player} onSave={onSave} onClose={onClose} />);
        await user.selectOptions(screen.getByRole('combobox', { name: 'Squad role' }), 'PLAYER');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(onSave).toHaveBeenCalledWith(12, 12, 'PLAYER');
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('edits a shirt number without replacing the squad role with the playing position', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<SquadRosterTable groups={groups} editable onUpdatePlayer={onSave} />);
        await user.click(screen.getByRole('button', { name: 'Edit shirt number for Nika Tsintsadze' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Shirt number' }), { target: { value: '24' } });
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(onSave).toHaveBeenCalledWith(12, 24, 'CAPTAIN');
    });

    it('keeps a failed edit available for retry', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <RosterPlayerEditor
                player={player}
                onSave={vi.fn().mockRejectedValue(new Error('Conflict'))}
                onClose={onClose}
            />,
        );
        await user.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('spinbutton', { name: 'Shirt number' })).toHaveValue(12);
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });
});
