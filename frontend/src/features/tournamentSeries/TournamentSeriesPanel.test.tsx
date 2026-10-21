import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { TournamentSeriesPanel } from './TournamentSeriesPanel';
import * as api from './api';

vi.mock('./api', () => ({ fetchTournamentSeries: vi.fn(), createTournamentSeries: vi.fn(), createNextEdition: vi.fn(), createTournamentDivision: vi.fn(), attachTournamentDivision: vi.fn(), updateTournamentSeries: vi.fn(), updateTournamentEdition: vi.fn() }));
const series: api.TournamentSeries = { id: 1, organizerOrganizationId: 2, name: 'Academy Cup', description: null, canManage: true, editions: [{ id: 10, label: '2026', startDate: '2026-09-20T09:00:00', endDate: '2026-09-22T18:00:00', divisions: [{ id: 20, tournamentId: 30, name: 'U12', tournamentName: 'Academy Cup U12', status: 'ACTIVE', visibility: 'PUBLIC', startDate: '2026-09-20T09:00:00', endDate: '2026-09-22T18:00:00' }] }] };
const mount = (canCreate = true) => render(<MemoryRouter><TournamentSeriesPanel tournamentId={30} canCreate={canCreate} tournamentName="Academy Cup"/></MemoryRouter>);

describe('Tournament series', () => {
    beforeEach(() => vi.resetAllMocks());
    it('creates a series around the current tournament and displays the saved edition', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue(null);
        vi.mocked(api.createTournamentSeries).mockResolvedValue(series);
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'Start a series from this tournament' }));
        await user.type(screen.getByLabelText('Current edition label'), '2026');
        await user.type(screen.getByLabelText('Current division name'), 'U12');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(api.createTournamentSeries).toHaveBeenCalledWith(30, { name: 'Academy Cup', description: '', editionLabel: '2026', divisionName: 'U12' });
        expect(await screen.findByRole('link', { name: 'U12' })).toHaveAttribute('href', '/tournaments/30/workspace');
    });
    it('keeps unsaved next-edition input after server rejection and permits retry', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue(series);
        vi.mocked(api.createNextEdition).mockRejectedValueOnce(new Error('Edition already exists')).mockResolvedValueOnce(series);
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'Prepare next edition' }));
        expect(screen.getByText(/Teams, players, staff, fixtures, results/)).toBeVisible();
        await user.type(screen.getByLabelText('New edition label'), '2029');
        fireEvent.change(screen.getByLabelText('Edition starts'), { target: { value: '2029-09-20T09:00' } });
        fireEvent.change(screen.getByLabelText('Edition ends'), { target: { value: '2029-09-22T18:00' } });
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Edition already exists');
        expect(screen.getByLabelText('New edition label')).toHaveValue('2029');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(api.createNextEdition).toHaveBeenLastCalledWith(1, 10, { label: '2029', startDate: '2029-09-20T09:00:00', endDate: '2029-09-22T18:00:00' });
        expect(await screen.findByRole('status')).toHaveTextContent('Tournament editions updated.');
    });
    it('creates a new division using the explicitly selected template', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue(series);
        vi.mocked(api.createTournamentDivision).mockResolvedValue(series);
        const user = userEvent.setup(); mount();
        await user.click(await screen.findByRole('button', { name: 'Add division' }));
        await user.type(screen.getByLabelText('Division name'), 'U14');
        await user.click(screen.getByRole('button', { name: 'Save' }));
        expect(api.createTournamentDivision).toHaveBeenCalledWith(1, 10, { name: 'U14', templateTournamentId: 30 });
    });
    it('does not present write controls to read-only viewers', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue({ ...series, canManage: false });
        mount(false);
        expect(await screen.findByRole('link', { name: 'U12' })).toHaveAttribute('href', '/tournaments/30');
        expect(screen.queryByRole('button', { name: 'Prepare next edition' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add division' })).not.toBeInTheDocument();
    });
    it('shows load failure distinctly from no series and retries', async () => {
        vi.mocked(api.fetchTournamentSeries).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null);
        const user = userEvent.setup(); mount();
        const alert = await screen.findByRole('alert');
        expect(screen.queryByRole('button', { name: 'Start a series from this tournament' })).not.toBeInTheDocument();
        await user.click(within(alert).getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('button', { name: 'Start a series from this tournament' })).toBeVisible();
    });
    it('corrects the series name and description without recreating its history', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue(series);
        vi.mocked(api.updateTournamentSeries).mockResolvedValue({ ...series, name: 'Community Academy Cup' });
        const user=userEvent.setup();mount();
        await user.click(await screen.findByRole('button',{name:'Edit series details'}));
        await user.clear(screen.getByLabelText('Series name'));await user.type(screen.getByLabelText('Series name'),'Community Academy Cup');
        await user.type(screen.getByLabelText('Description'),'Our annual tournament');
        await user.click(screen.getByRole('button',{name:'Save'}));
        expect(api.updateTournamentSeries).toHaveBeenCalledWith(1,{name:'Community Academy Cup',description:'Our annual tournament'});
        expect(await screen.findByRole('heading',{name:'Community Academy Cup'})).toBeVisible();
    });
    it('edits the edition window and retains input if linked divisions would fall outside', async () => {
        vi.mocked(api.fetchTournamentSeries).mockResolvedValue(series);
        vi.mocked(api.updateTournamentEdition).mockRejectedValueOnce(new Error('The edition dates must include every linked division.')).mockResolvedValueOnce(series);
        const user=userEvent.setup();mount();
        await user.click(await screen.findByRole('button',{name:'Edit edition dates & label'}));
        fireEvent.change(screen.getByLabelText('Edition ends'),{target:{value:'2026-09-21T18:00'}});
        await user.click(screen.getByRole('button',{name:'Save'}));
        expect(await screen.findByRole('alert')).toHaveTextContent('include every linked division');
        expect(screen.getByLabelText('Edition ends')).toHaveValue('2026-09-21T18:00');
        fireEvent.change(screen.getByLabelText('Edition ends'),{target:{value:'2026-09-25T18:00'}});
        await user.click(screen.getByRole('button',{name:'Save'}));
        expect(api.updateTournamentEdition).toHaveBeenLastCalledWith(1,10,{label:'2026',startDate:'2026-09-20T09:00:00',endDate:'2026-09-25T18:00:00'});
    });
});
