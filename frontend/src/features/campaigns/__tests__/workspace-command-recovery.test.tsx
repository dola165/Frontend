import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { ClubCampaignsPage } from '../../clubWorkspace/commerce/ClubCampaignsPage';
import * as api from '../api';

vi.mock('../api', async original => ({ ...await original<typeof import('../api')>(), fetchManagedCampaigns: vi.fn(), createCampaign: vi.fn() }));

it('keeps an uncertain workspace creation across remount and retries the original save explicitly', async () => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('gk-session-id', 'workspace-command-test');localStorage.setItem('userId', '1');
    vi.mocked(api.fetchManagedCampaigns).mockResolvedValue([]);
    vi.mocked(api.createCampaign).mockRejectedValueOnce(new Error('Response lost'));
    const open = () => render(<MemoryRouter><ClubCampaignsPage clubId={10} /></MemoryRouter>);
    const first = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Create campaign' }));
    fireEvent.change(screen.getByLabelText('Campaign title'), { target: { value: 'Synthetic workspace recovery' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save campaign' })));
    expect(screen.getByRole('button', { name: 'Save campaign' })).toBeDisabled();
    expect(screen.getByLabelText('Campaign title')).toHaveValue('Synthetic workspace recovery');
    const [club, input, key] = vi.mocked(api.createCampaign).mock.calls[0];expect(key).toEqual(expect.any(String));
    first.unmount();open();
    expect(api.createCampaign).toHaveBeenCalledTimes(1);
    const saved: api.Campaign = { ...input, id: 91, clubId: club, clubName: 'Synthetic FC', status: 'CLOSED', phase: 'CLOSED', version: 5, updates: [], reportedAt: null, updatedAt: '', publishedAt: '2026-10-18T00:00:00Z' };
    vi.mocked(api.createCampaign).mockResolvedValue(saved);vi.mocked(api.fetchManagedCampaigns).mockResolvedValue([saved]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry original change' })));
    expect(api.createCampaign).toHaveBeenLastCalledWith(club, input, key);
    expect(await screen.findByRole('heading', { name: 'Synthetic workspace recovery' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry original change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Campaign editor' })).not.toBeInTheDocument();
});
