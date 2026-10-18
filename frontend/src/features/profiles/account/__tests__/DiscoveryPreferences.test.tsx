import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../api/axiosConfig';
import { DiscoveryPreferencesEditor } from '../DiscoveryPreferencesEditor';
import i18n from '../../../../i18n';

vi.mock('../../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));
beforeEach(async () => {
    vi.resetAllMocks(); await i18n.changeLanguage('en');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { openTo: [], licence: null, rate: null, version: 4 } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { openTo: ['WORK', 'SERVICES'], licence: 'B', rate: { amount: 50, currency: 'GEL', per: 'SESSION' }, version: 5 } });
});
afterEach(cleanup);

it('saves explicit availability with the reviewed revision and stated session price', async () => {
    render(<DiscoveryPreferencesEditor />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Open to work' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Offer private sessions' }));
    fireEvent.change(screen.getByLabelText('Coaching licence (self-reported)'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Price per session (optional)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByText('Saved.');
    expect(apiClient.put).toHaveBeenCalledWith('/users/me/discovery', { openTo: ['WORK', 'SERVICES'], licence: 'B', rate: { amount: 50, currency: 'GEL', per: 'SESSION' }, expectedVersion: 4, requestId: expect.any(String) });
});

it('keeps the draft and retries the same command when an acknowledgement is lost', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Connection lost'));
    render(<DiscoveryPreferencesEditor />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Open to work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('checkbox', { name: 'Open to work' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByText('Saved.');
    expect(vi.mocked(apiClient.put).mock.calls[0][1]).toEqual(vi.mocked(apiClient.put).mock.calls[1][1]);
});

it('does not advertise an old session price after private sessions are disabled', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { openTo: ['SERVICES'], licence: null, rate: { amount: 50, currency: 'GEL', per: 'SESSION' }, version: 4 } });
    render(<DiscoveryPreferencesEditor />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Offer private sessions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save availability' }));
    await screen.findByText('Saved.');
    expect(apiClient.put).toHaveBeenCalledWith('/users/me/discovery', expect.objectContaining({ openTo: [], rate: null }));
});
