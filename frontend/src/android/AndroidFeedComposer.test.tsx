import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import '../i18n';

const transport = vi.hoisted(() => ({ get: vi.fn(), nativeCall: vi.fn().mockResolvedValue({ status: 204 }), postId: undefined as number | undefined }));
vi.mock('./bridge', async original => ({ ...await original<typeof import('./bridge')>(), isAndroidApp: true, nativeCall: transport.nativeCall }));
vi.mock('../api/axiosConfig', () => ({ apiClient: { get: transport.get }, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../components/feed/PostComposer', () => ({ PostComposer: function TestComposer({ onPostCreated, onCreateEvent }: {
    onPostCreated: (postId?: number) => void; onCreateEvent: () => void;
}) {
    const [draft, setDraft] = useState('');
    return <><textarea aria-label="Post caption" value={draft} onChange={event => setDraft(event.target.value)} />
        <button onClick={() => onPostCreated(transport.postId)}>Confirm successful publish</button>
        <button onClick={onCreateEvent}>Create event</button></>;
} }));
import { FeedPage } from '../pages/FeedPage';

beforeEach(() => { vi.clearAllMocks(); transport.postId = undefined; transport.nativeCall.mockResolvedValue({ status: 204 }); });

it('opens the focused Android editor without starting any feed requests and returns after confirmed publication', async () => {
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage user={{ fullName: 'Giorgi' }} /></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Home posts' })).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
    expect(transport.nativeCall).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirm successful publish'));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledWith({ kind: 'navigate', path: '/home?published=1' }));
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
    // Native can acknowledge before the navigation completes. Keep a way home
    // available even if it never rejects and the screen remains mounted.
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
});

it('keeps publication confirmed if native return fails and retries navigation without resubmitting', async () => {
    transport.postId = 41;
    transport.nativeCall.mockRejectedValueOnce(new Error('Navigation unavailable'));
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Confirm successful publish'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your post is published');
    expect(transport.nativeCall).toHaveBeenNthCalledWith(1, { kind: 'navigate', path: '/home?published=1&postId=41' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledTimes(2));
    expect(transport.nativeCall).toHaveBeenNthCalledWith(2, { kind: 'navigate', path: '/home?published=1' });
    expect(screen.getByRole('status')).toHaveTextContent('Post published');
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('hands the confirmed post ID to native navigation so the published post opens directly', async () => {
    transport.postId = 52;
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Confirm successful publish'));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledWith({ kind: 'navigate', path: '/home?published=1&postId=52' }));
    expect(screen.queryByText('Confirm successful publish')).not.toBeInTheDocument();
    expect(transport.get).not.toHaveBeenCalled();
});

it('explains failed event navigation and retains the current post draft for retry', async () => {
    transport.nativeCall.mockRejectedValueOnce(new Error('Navigation unavailable'));
    render(<MemoryRouter initialEntries={['/home?compose=1']}><FeedPage /></MemoryRouter>);
    const caption = screen.getByRole('textbox', { name: 'Post caption' });
    fireEvent.change(caption, { target: { value: 'Keep this training update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your post draft is still here');
    expect(screen.getByRole('textbox', { name: 'Post caption' })).toBe(caption);
    expect(caption).toHaveValue('Keep this training update');
    expect(transport.nativeCall).toHaveBeenCalledWith({ kind: 'navigate', path: '/calendar?newEvent=1' });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await waitFor(() => expect(transport.nativeCall).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(caption).toHaveValue('Keep this training update');
    expect(transport.get).not.toHaveBeenCalled();
});
