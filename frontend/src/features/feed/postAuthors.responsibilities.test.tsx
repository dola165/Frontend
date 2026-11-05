import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import '../../i18n';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/axiosConfig';
import { setStoredAccessToken } from '../../utils/authStorage';
import { RequestsCentre } from '../requests/RequestsCentre';
import type { Appointment } from '../clubOperations/api';
import { usePostAuthors } from './postAuthors';

vi.mock('../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn() }, ensureCsrfToken: vi.fn(async () => undefined), refreshAccessToken: vi.fn(),
    setAccountRestrictionHandler: vi.fn(), setAuthFailureHandler: vi.fn(), setDisplayedAuthSession: vi.fn(),
}));

const clubName = 'FC Dinamo Tbilisi Academy';
const capabilities = { version: 1, workspaces: [
    { id: 'club.office', context: { type: 'club', id: 1, label: clubName } },
    { id: 'club.member', context: { type: 'club', id: 1, label: clubName } },
] };
const media: Appointment = {
    id: 7, club_id: 1, club_name: clubName, user_id: 2, title: 'Media officer', specialisations: ['MEDIA_OFFICER'],
    engagement: 'VOLUNTEER', squad_id: null, permissions: ['POSTS:WRITE'], starts_on: '2000-01-01', ends_on: null,
    status: 'INVITED', effective_status: 'INVITED', revision: 0, published: false,
};
let appointment: Appointment;
const authorReads = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === '/posts/authors').length;

function Choices() {
    const { authors, loaded } = usePostAuthors();
    return <output aria-label="Posting choices">{loaded ? authors.map(author => author.name).join(', ') || 'Personal only' : 'Loading'}</output>;
}
function Workspace() {
    const { status, user, refreshNavigationCapabilities } = useAuth();
    const [showChoices, setShowChoices] = useState(true);
    if (status !== 'authenticated') return null;
    return <>
        <output aria-label="Workspace shortcuts">{JSON.stringify(user?.navigationCapabilities)}</output>
        <button onClick={() => setShowChoices(value => !value)}>Toggle composer</button>
        <button onClick={() => void refreshNavigationCapabilities()}>Refresh responsibilities</button>
        {showChoices && <Choices />}
        <RequestsCentre />
    </>;
}

beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); setStoredAccessToken('same-session');
    appointment = { ...media };
    vi.mocked(apiClient.get).mockImplementation(async url => {
        if (url === '/users/me') return { data: { id: 2, profileComplete: true, emailVerified: true, navigationCapabilities: capabilities } };
        if (url === '/posts/authors') return { data: appointment.status === 'ACTIVE' ? [{ clubId: 1, clubName, name: clubName }] : [] };
        if (url === '/club-operations/mine') return { data: { appointments: [appointment], permissions: [], clubs: [{ id: 1, name: clubName }] } };
        if (url === '/requests') return { data: { items: [], counts: { incoming: 0, actionable: 0, outgoing: 0, history: 0 }, total: 0, hasMore: false, unavailableSources: [] } };
        throw new Error(`Unexpected read: ${url}`);
    });
    vi.mocked(apiClient.post).mockImplementation(async (url, body) => {
        expect(url).toBe('/clubs/1/operations/appointments/7/transition');
        const { status } = body as { status: string };
        appointment = { ...appointment, status, effective_status: status, revision: appointment.revision + 1 };
        return { data: {} };
    });
});
afterEach(cleanup);

it('refreshes posting choices after real Inbox acceptance and ending with unchanged shortcuts', async () => {
    render(<MemoryRouter initialEntries={['/requests']}><AuthProvider><Workspace /></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent('Personal only'));
    const shortcuts = screen.getByLabelText('Workspace shortcuts').textContent;
    // Equipment duties already give these same office/member shortcuts. The Media officer job adds posting authority.
    fireEvent.click(await screen.findByRole('button', { name: 'Accept appointment' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm acceptance' }));
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent(clubName));
    expect(apiClient.post).toHaveBeenCalledWith('/clubs/1/operations/appointments/7/transition', { revision: 0, status: 'ACTIVE', note: null });
    expect(screen.getByLabelText('Workspace shortcuts').textContent).toBe(shortcuts);

    // Also invalidate the cached promise while Home/the composer is unmounted.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle composer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'End this appointment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm end' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenLastCalledWith('/clubs/1/operations/appointments/7/transition', { revision: 1, status: 'ENDED', note: null }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'End this appointment' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Toggle composer' }));
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent('Personal only'));
    expect(screen.getByLabelText('Workspace shortcuts').textContent).toBe(shortcuts);
});

it('revalidates on focus and ignores superseded responsibility responses', async () => {
    render(<MemoryRouter><AuthProvider><Workspace /></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent('Personal only'));
    appointment = { ...appointment, status: 'ACTIVE', effective_status: 'ACTIVE' };
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent(clubName));

    let finish!: (value: { data: unknown }) => void;
    vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh responsibilities' }));
    appointment = { ...appointment, status: 'ENDED', effective_status: 'ENDED' };
    fireEvent.click(screen.getByRole('button', { name: 'Refresh responsibilities' }));
    await waitFor(() => expect(screen.getByLabelText('Posting choices')).toHaveTextContent('Personal only'));
    const reads = authorReads();
    await act(async () => { finish({ data: { id: 2, navigationCapabilities: capabilities } }); });
    expect(authorReads()).toBe(reads);
    expect(screen.getByLabelText('Posting choices')).toHaveTextContent('Personal only');
});
