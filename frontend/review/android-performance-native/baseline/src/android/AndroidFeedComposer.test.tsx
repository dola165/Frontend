import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import '../i18n';

const transport = vi.hoisted(() => ({ get: vi.fn(), nativeCall: vi.fn().mockResolvedValue({ status: 204 }) }));
vi.mock('./bridge', async original => ({ ...await original<typeof import('./bridge')>(), isAndroidApp: true, nativeCall: transport.nativeCall }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { get: transport.get }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../components/feed/PostComposer', () => ({ PostComposer: ({ onPostCreated }: { onPostCreated: () => void }) =>
    <button onClick={onPostCreated}>Confirm successful publish</button> }));
import { FeedPage } from '../pages/FeedPage';

beforeEach(() => { vi.clearAllMocks(); transport.nativeCall.mockResolvedValue({ status: 204 }); });

it('opens the focused Android editor without starting any feed requests and returns after confirmed publication', async () => {
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage user={{ fullName: 'Giorgi' }} /></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Home posts' })).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
    expect(transport.nativeCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm successful publish'));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledWith({ kind: 'navigate', path: '/home?published=1' }));
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
});

it('keeps publication confirmed if native return fails and retries navigation without resubmitting', async () => {
    transport.nativeCall.mockRejectedValueOnce(new Error('Navigation unavailable'));
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Confirm successful publish'));
    fireEvent.click(await screen.findByRole('button', { name: 'Back to Home' }));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toHaveTextContent('Post published');
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
});
