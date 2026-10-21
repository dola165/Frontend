import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../api/axiosConfig';
import { StartFundraiserPage } from '../../../pages/StartFundraiserPage';
import { fetchMyClubMembershipContext } from '../../clubs/api';
import * as api from '../api';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 } }) }));
vi.mock('../../clubs/api', () => ({ fetchMyClubMembershipContext: vi.fn() }));
vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), createCampaign: vi.fn(), editCampaign: vi.fn(), fetchManagedCampaign: vi.fn(), changeCampaignState: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { post: vi.fn() }, DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' } }));
const draft = { category: 'TRAVEL', goal: '5000', currency: 'GEL', title: 'Girls to the Black Sea Cup', summary: 'Travel and two nights for 18 players.', useOfFunds: 'Travel and accommodation', image: '', donateUrl: '', clubId: 10 };
const input: api.CampaignInput = { title: draft.title, summary: draft.summary, description: draft.summary, beneficiary: 'Alpha FC', useOfFunds: draft.useOfFunds, category: draft.category, currency: draft.currency, goalAmount: 5000, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: [], donateUrl: null };
const saved: api.Campaign = { ...input, id: 90, clubId: 10, clubName: 'Alpha FC', version: 1, status: 'DRAFT', phase: 'DRAFT', updates: [], reportedAt: null, updatedAt: '2026-10-17T00:00:00Z', publishedAt: null };
const open = (step = 3) => render(<MemoryRouter initialEntries={[`/campaigns/new?step=${step}`]}><Routes><Route path="/campaigns/new" element={<StartFundraiserPage />} /><Route path="/campaigns/:id" element={<h1>Published fundraiser</h1>} /></Routes></MemoryRouter>);
const submit = async () => { const button = await screen.findByRole('button', { name: 'Publish fundraiser' }); await act(async () => { fireEvent.click(button); }); };

beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('userId', '1');
    sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify(draft));
    vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'OWNER' });
    vi.mocked(api.createCampaign).mockResolvedValue(saved);
    vi.mocked(api.fetchManagedCampaign).mockResolvedValue(saved);
    vi.mocked(api.changeCampaignState).mockResolvedValue({ ...saved, status: 'PUBLISHED', version: 2 });
});

describe('Fundraiser save and publication recovery', () => {
    it('retains a saved draft across remount and publishes that same id on retry', async () => {
        vi.mocked(api.changeCampaignState).mockRejectedValueOnce(new Error('Publish unavailable')).mockResolvedValue({ ...saved, status: 'PUBLISHED', version: 2 });
        const first = open(); await submit();
        await screen.findByRole('alert');
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!)).toMatchObject({ saved: { id: 90, version: 1 }, title: draft.title });
        first.unmount(); open(); await submit();
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(api.createCampaign).toHaveBeenCalledTimes(1);
        expect(api.fetchManagedCampaign).toHaveBeenCalledWith(10, 90);
        expect(api.changeCampaignState).toHaveBeenLastCalledWith(10, expect.objectContaining({ id: 90, version: 1 }), 'PUBLISHED');
    });

    it('replays the exact create payload and key after an uncertain response, even when answers change', async () => {
        vi.mocked(api.createCampaign).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValue(saved);
        vi.mocked(api.editCampaign).mockResolvedValue({ ...saved, title: 'Updated travel plan', version: 2 });
        const first = open(); await submit(); await screen.findByRole('alert');
        const firstCall = vi.mocked(api.createCampaign).mock.calls[0];
        expect(firstCall[2]).toMatch(/^[\da-f-]{36}$/i);
        const stored = JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!);
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...stored, title: 'Updated travel plan' }));
        first.unmount(); open(); await submit();
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(vi.mocked(api.createCampaign).mock.calls[1]).toEqual(firstCall);
        expect(api.editCampaign).toHaveBeenCalledWith(10, 90, expect.objectContaining({ title: 'Updated travel plan', version: 1 }));
    });

    it('checks a lost publication response and does not publish a live fundraiser again', async () => {
        vi.mocked(api.changeCampaignState).mockRejectedValueOnce(new Error('Response lost'));
        open(); await submit(); await screen.findByRole('alert');
        vi.mocked(api.fetchManagedCampaign).mockResolvedValue({ ...saved, status: 'PUBLISHED', version: 2 });
        await submit(); await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(api.createCampaign).toHaveBeenCalledTimes(1);
        expect(api.changeCampaignState).toHaveBeenCalledTimes(1);
    });

    it.each(['DRAFT', 'PUBLISHED'] as const)('retains a recovered manager edit in %s for explicit review across retries, edits and remounts', async status => {
        vi.mocked(api.createCampaign).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ ...saved, title: 'Other manager changed this', status, version: 4 });
        const first = open(); await submit(); await screen.findByRole('alert');
        const stored = JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!);
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...stored, title: 'Local changed answer' }));
        first.unmount(); const recovered = open(); await submit();
        expect(await screen.findByRole('alert')).toHaveTextContent('changed elsewhere');
        expect(screen.getByRole('link', { name: 'Open saved fundraiser' })).toHaveAttribute('href', '/campaigns/90/manage/edit?club=10');
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!)).toMatchObject({ title: 'Local changed answer', saved: { id: 90, version: 4, input, reviewRequired: true } });
        expect(vi.mocked(api.createCampaign).mock.calls[1]).toEqual(vi.mocked(api.createCampaign).mock.calls[0]);
        await submit();
        recovered.unmount(); open();
        expect(await screen.findByRole('alert')).toHaveTextContent('changed elsewhere');
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Another local answer' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('button', { name: 'Publish fundraiser' })).toBeDisabled();
        await submit();
        expect(api.createCampaign).toHaveBeenCalledTimes(2);
        expect(api.fetchManagedCampaign).not.toHaveBeenCalled();
        expect(api.editCampaign).not.toHaveBeenCalled();
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!)).toMatchObject({ title: 'Another local answer', saved: { id: 90, version: 4, reviewRequired: true } });
    });

    it('accepts a matching normalized replay when the real backend omits prototype provider fields', async () => {
        const donateUrl = 'https://www.gofundme.com/f/travel';
        const attempt = { key: crypto.randomUUID(), input: { ...input, summary: ` ${input.summary} `, beneficiary: ' Alpha FC ', donateUrl } };
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, donateUrl, createAttempt: attempt }));
        const realResponse = { ...saved }; delete realResponse.donateUrl;
        vi.mocked(api.createCampaign).mockResolvedValue(realResponse);
        vi.mocked(api.editCampaign).mockResolvedValue({ ...realResponse, version: 2 });
        open(); await submit();
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(api.createCampaign).toHaveBeenCalledWith(10, attempt.input, attempt.key);
        expect(api.editCampaign).not.toHaveBeenCalled();
        expect(api.changeCampaignState).toHaveBeenCalledOnce();
    });

    it('does not republish when create-request replay returns an already published fundraiser', async () => {
        vi.mocked(api.createCampaign).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ ...saved, status: 'PUBLISHED', version: 2 });
        const first = open(); await submit(); await screen.findByRole('alert');
        first.unmount(); open(); await submit();
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(api.createCampaign).toHaveBeenCalledTimes(2);
        expect(vi.mocked(api.createCampaign).mock.calls[1]).toEqual(vi.mocked(api.createCampaign).mock.calls[0]);
        expect(api.changeCampaignState).not.toHaveBeenCalled();
    });

    it('clears an already-published recovery after a delayed reply and remounts with blank answers', async () => {
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, createAttempt: { key: crypto.randomUUID(), input } }));
        let recover!: (value: api.Campaign) => void;
        vi.mocked(api.createCampaign).mockImplementationOnce(() => new Promise(resolve => { recover = resolve; }));
        const view = open(); await submit();
        expect(api.createCampaign).toHaveBeenCalledOnce();
        await act(async () => recover({ ...saved, status: 'PUBLISHED', version: 2 }));
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(sessionStorage.getItem('gk.fundraiser.draft:1')).toBeNull();
        expect(api.editCampaign).not.toHaveBeenCalled();
        expect(api.changeCampaignState).not.toHaveBeenCalled();
        view.unmount(); open(2);
        expect(await screen.findByLabelText('Title')).toHaveValue('');
        expect(screen.getByLabelText('Your story')).toHaveValue('');
        expect(screen.queryByRole('link', { name: 'Open saved fundraiser' })).not.toBeInTheDocument();
    });

    it('clears an immediately resolved published replay without leaving a queued create receipt', async () => {
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, createAttempt: { key: crypto.randomUUID(), input } }));
        vi.mocked(api.createCampaign).mockResolvedValue({ ...saved, status: 'PUBLISHED', version: 2 });
        open(); await submit();
        await screen.findByRole('heading', { name: 'Published fundraiser' });
        expect(sessionStorage.getItem('gk.fundraiser.draft:1')).toBeNull();
        expect(api.changeCampaignState).not.toHaveBeenCalled();
    });

    it('keeps the published receipt and changed local answers instead of completing the older request', async () => {
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, title: 'Our new travel plan', createAttempt: { key: crypto.randomUUID(), input } }));
        const published = { ...saved, status: 'PUBLISHED' as const, version: 2 };
        vi.mocked(api.createCampaign).mockResolvedValue(published);
        vi.mocked(api.fetchManagedCampaign).mockResolvedValue(published);
        const view = open(); await submit();
        expect(await screen.findByRole('alert')).toHaveTextContent('already live');
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!)).toMatchObject({ title: 'Our new travel plan', saved: { id: 90, version: 2, input } });
        view.unmount(); open(); await submit();
        expect(await screen.findByRole('alert')).toHaveTextContent('already live');
        expect(api.createCampaign).toHaveBeenCalledOnce();
        expect(api.editCampaign).not.toHaveBeenCalled();
        expect(api.changeCampaignState).not.toHaveBeenCalled();
    });

    it('does not overwrite a draft changed elsewhere and keeps the local answers', async () => {
        vi.mocked(api.changeCampaignState).mockRejectedValueOnce(new Error('Publish unavailable'));
        open(); await submit(); await screen.findByRole('alert');
        vi.mocked(api.fetchManagedCampaign).mockResolvedValue({ ...saved, version: 4 });
        await submit();
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('changed elsewhere'));
        expect(api.createCampaign).toHaveBeenCalledTimes(1);
        expect(api.editCampaign).not.toHaveBeenCalled();
        expect(api.changeCampaignState).toHaveBeenCalledTimes(1);
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!)).toMatchObject({ title: draft.title, saved: { id: 90, version: 1 } });
    });

    it('distinguishes a failed membership check from having no club and offers retry', async () => {
        vi.mocked(fetchMyClubMembershipContext).mockRejectedValueOnce(new Error('Offline'));
        open();
        expect(await screen.findByText('Your club could not be checked')).toBeInTheDocument();
        expect(screen.queryByText('You need a club to start a fundraiser')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry club check' }));
        expect(await screen.findByRole('button', { name: 'Publish fundraiser' })).toBeEnabled();
    });

    it('keeps a coach without club leadership from using the backend owner/admin publishing action', async () => {
        vi.mocked(fetchMyClubMembershipContext).mockResolvedValue({ hasClubMembership: true, canCreateClub: false, clubId: 10, clubName: 'Alpha FC', myRole: 'COACH' });
        open();
        await screen.findByText('Only Alpha FC’s staff can start a fundraiser');
        expect(screen.queryByRole('button', { name: 'Publish fundraiser' })).not.toBeInTheDocument();
        expect(api.createCampaign).not.toHaveBeenCalled();
    });

    it('serializes photo selection and removal, including returning to the step during an upload', async () => {
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, images: ['/original.png'] }));
        const completions: ((value: { data: { url: string } }) => void)[] = [];
        vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => completions.push(resolve)));
        open(2); await screen.findByRole('heading', { name: 'Tell supporters what it is' });
        const select = (name: string) => fireEvent.change(screen.getByLabelText('Add campaign photo (up to 8)'), { target: { files: [new File([name], `${name}.png`, { type: 'image/png' })] } });
        select('a'); select('b');
        expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('Add campaign photo (up to 8)')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Remove photo 1' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        select('b');
        expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        await act(async () => completions[0]({ data: { url: '/a.png' } }));
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
        select('b');
        expect(apiClient.post).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        await act(async () => completions[1]({ data: { url: '/b.png' } }));
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!).images).toEqual(['/original.png', '/a.png', '/b.png']);
    });

    it('keeps the last photo slot available after failure and never uploads a ninth photo', async () => {
        const images = Array.from({ length: 7 }, (_, index) => `/photo-${index}.png`);
        sessionStorage.setItem('gk.fundraiser.draft:1', JSON.stringify({ ...draft, images }));
        vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { data: { message: 'Upload unavailable' } } }).mockResolvedValue({ data: { url: '/last.png' } });
        open(2); await screen.findByRole('heading', { name: 'Tell supporters what it is' });
        const picker = screen.getByLabelText('Add campaign photo (up to 8)');
        const choose = () => fireEvent.change(picker, { target: { files: [new File(['last'], 'last.png', { type: 'image/png' })] } });
        await act(async () => choose());
        await screen.findByRole('alert');
        expect(picker).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
        await act(async () => { choose(); choose(); });
        expect(apiClient.post).toHaveBeenCalledTimes(2);
        expect(screen.queryByLabelText('Add campaign photo (up to 8)')).not.toBeInTheDocument();
        choose();
        expect(apiClient.post).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
        expect(JSON.parse(sessionStorage.getItem('gk.fundraiser.draft:1')!).images).toEqual([...images, '/last.png']);
    });
});
