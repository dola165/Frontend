import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageFundraiser } from '../manage/ManageFundraiser';
import * as api from '../api';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchManagedCampaign: vi.fn(), changeCampaignState: vi.fn() }));
vi.mock('../manage/manageAccess', () => ({ useManagesFundraisers: () => true, manageToolPath: (id: number, tool: string) => `/campaigns/${id}/manage/${tool}` }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const campaign: api.Campaign = { id: 90, clubId: 10, clubName: 'Alpha FC', title: 'Travel for the girls', summary: 'A tournament trip for 18 players.', description: 'Travel and accommodation.', beneficiary: 'The youth team', useOfFunds: 'Coach travel and two nights', category: 'TRAVEL', currency: 'GEL', goalAmount: 5000, reportedAmount: null, reportedNote: '', reportedAt: null, startsOn: null, endsOn: null, images: [], status: 'PUBLISHED', phase: 'ACTIVE', version: 2, publishedAt: '2026-10-16T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z', updates: [] };
const onChanged = vi.fn();
const element = (value = campaign) => <MemoryRouter><ManageFundraiser campaign={value} onChanged={onChanged} allowed /></MemoryRouter>;
const openMenu = () => fireEvent.click(screen.getByLabelText(`More actions for ${campaign.title}`));
const end = async () => {
    openMenu(); fireEvent.click(screen.getByRole('button', { name: 'End fundraiser' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'End this fundraiser?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'End fundraiser' }));
};

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear();
    localStorage.setItem('gk-session-id', 'owner-a');
    vi.mocked(api.fetchManagedCampaign).mockResolvedValue(campaign);
    vi.mocked(api.changeCampaignState).mockResolvedValue({ ...campaign, status: 'PAUSED', version: 3 });
});

describe('Fundraiser state actions belong to the reviewed version and visit', () => {
    it('stops an end action after another manager edits the fundraiser, then refreshes without mutation', async () => {
        const latest = { ...campaign, title: 'A new tournament plan', version: 4 };
        vi.mocked(api.fetchManagedCampaign).mockResolvedValue(latest);
        const view = render(element()); await end();
        expect(await screen.findByRole('alert')).toHaveTextContent('changed');
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        expect(onChanged).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        view.rerender(element(latest));
        fireEvent.click(screen.getByLabelText(`More actions for ${latest.title}`));
        fireEvent.click(screen.getByRole('button', { name: 'End fundraiser' }));
        const dialog = await screen.findByRole('alertdialog', { name: 'End this fundraiser?' });
        expect(dialog).toHaveTextContent(latest.title);
        fireEvent.click(within(dialog).getByRole('button', { name: 'End fundraiser' }));
        await act(async () => {});
        expect(api.changeCampaignState).toHaveBeenCalledOnce();
        expect(api.changeCampaignState).toHaveBeenCalledWith(10, latest, 'CLOSED');
    });

    it('pauses the version the manager reviewed when it is still current', async () => {
        render(element()); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        await act(async () => {});
        expect(api.changeCampaignState).toHaveBeenCalledWith(10, campaign, 'PAUSED');
        expect(onChanged).toHaveBeenCalledOnce();
    });

    it('does not resume a fundraiser that another manager has since closed', async () => {
        const paused = { ...campaign, status: 'PAUSED' as const, version: 3 };
        vi.mocked(api.fetchManagedCampaign).mockResolvedValue({ ...campaign, status: 'CLOSED', version: 4 });
        render(element(paused)); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('changed');
        expect(api.changeCampaignState).not.toHaveBeenCalled();
    });

    it('cannot start a state write after the session changes during the read', async () => {
        let finish!: (value: api.Campaign) => void;
        vi.mocked(api.fetchManagedCampaign).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        render(element()); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        localStorage.setItem('gk-session-id', 'owner-b');
        await act(async () => finish(campaign));
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        expect(onChanged).not.toHaveBeenCalled();
    });

    it('keeps a server conflict recoverable through a refresh without repeating the state write', async () => {
        vi.mocked(api.changeCampaignState).mockRejectedValue({ response: { data: { message: 'The fundraiser changed while saving.' } } });
        render(element()); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('changed while saving');
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        expect(onChanged).toHaveBeenCalledOnce();
        expect(api.changeCampaignState).toHaveBeenCalledOnce();
    });

    it('cannot start a state write after the manager leaves the component', async () => {
        let finish!: (value: api.Campaign) => void;
        vi.mocked(api.fetchManagedCampaign).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const view = render(element()); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        view.unmount();
        await act(async () => finish(campaign));
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        expect(onChanged).not.toHaveBeenCalled();
    });

    it('ignores an old session response after the write was already sent', async () => {
        let finish!: (value: api.Campaign) => void;
        vi.mocked(api.changeCampaignState).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        render(element()); openMenu(); fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        await act(async () => {});
        expect(api.changeCampaignState).toHaveBeenCalledOnce();
        localStorage.setItem('gk-session-id', 'owner-b');
        await act(async () => finish({ ...campaign, status: 'PAUSED', version: 3 }));
        expect(onChanged).not.toHaveBeenCalled();
    });
});
