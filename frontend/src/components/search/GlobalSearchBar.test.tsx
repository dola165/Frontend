import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { GlobalSearchBar } from './GlobalSearchBar';
import { apiClient } from '../../api/axiosConfig';

const auth = vi.hoisted(() => ({ user: { id: 7 }, sessionId: 'search-session' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
function Destination() { const location = useLocation(); return <output data-testid="destination">{JSON.stringify(location)}</output>; }
const page = () => render(<MemoryRouter><GlobalSearchBar mobile /><Destination /></MemoryRouter>);
beforeEach(() => {
    auth.sessionId = 'search-session';
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/tournaments/discovery' ? { items: [], total: 0, hasMore: false } : path === '/users/search' ? { content: [{ id: 45, fullName: 'Giorgi Beridze', username: 'giorgi' }] } : path === '/organizations/discovery' ? emptyDiscovery : [] }));
});
const emptyDiscovery = { organizations: [], venues: [], moreOrganizations: false, moreVenues: false };
const company = { id: 21, name: 'Football Partners', location: 'Tbilisi', profileKind: 'COMPANY', venueCount: 2, fromPrice: null, currency: null, bookingMode: null };
const venue = { id: 22, name: 'Football Ground', location: 'Rustavi · Main Street', profileKind: 'VENUE', venueCount: 0, fromPrice: 80, currency: 'GEL', bookingMode: 'REQUEST' };
function discoveryMock(failUsers = false) {
    vi.mocked(apiClient.get).mockImplementation(async path => {
        if (path === '/users/search' && failUsers) throw new Error('offline');
        return { data: path === '/organizations/discovery' ? { ...emptyDiscovery, organizations: [company], venues: [venue] } : path === '/tournaments/discovery' ? { items: [], total: 0, hasMore: false } : path === '/users/search' ? { content: [] } : [] };
    });
}
afterEach(cleanup);
describe('Search and Dola handoff', () => {
    it('offers useful starting points on focus without issuing an empty search', () => {
        page();
        expect(screen.getByText('Start with a name, club, or place.')).toBeVisible();
        expect(apiClient.get).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('link', { name: 'Browse clubs' }));
        expect(screen.getByTestId('destination')).toHaveTextContent('"pathname":"/clubs"');
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    });
    it('opens a question on Enter before search finishes and carries its text privately', () => {
        page(); const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'How do I join a club?' } });
        expect(screen.getByTestId('destination')).not.toHaveTextContent('/assistant');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByTestId('destination')).toHaveTextContent('"pathname":"/assistant"');
        expect(screen.getByTestId('destination')).toHaveTextContent('"search":""');
        expect(screen.getByTestId('destination')).toHaveTextContent('How do I join a club?');
    });
    it('keeps a person search as ordinary search and opens its result on Enter', async () => {
        page(); const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Giorgi' } });
        await screen.findByRole('link', { name: /Giorgi\s+Beridze/ });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByTestId('destination')).toHaveTextContent('/profile/45');
    });
    it('allows selecting a normal result even when the query looks like a question', async () => {
        page(); const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Who is Giorgi?' } });
        const person = await screen.findByRole('link', { name: /Giorgi Beridze/ });
        fireEvent.click(person);
        expect(screen.getByTestId('destination')).toHaveTextContent('/profile/45');
    });
    it('offers an explicit Dola choice for an ambiguous search', () => {
        page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'training advice' } });
        fireEvent.click(screen.getByRole('button', { name: /Ask Agent Dola/ }));
        expect(screen.getByTestId('destination')).toHaveTextContent('/assistant');
    });
    it('ignores Enter while an input method is composing', () => {
        page(); const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'როგორ ვიპოვო კლუბი?' } });
        fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
        expect(screen.getByTestId('destination')).not.toHaveTextContent('/assistant');
    });
    it('opens the canonical organization profile and offers its contact and venue tabs', async () => {
        discoveryMock(); page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        const result = await screen.findByRole('link', { name: /Football Partners · Organization · Tbilisi/ });
        expect(result).toHaveAttribute('href', '/organizations/21');
        expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/organizations/21?tab=contact');
        expect(screen.getByRole('link', { name: 'View venues' })).toHaveAttribute('href', '/organizations/21?tab=venues');
        fireEvent.click(result);
        expect(screen.getByTestId('destination')).toHaveTextContent('/organizations/21');
    });
    it('distinguishes venue results and opens availability without implying a reservation', async () => {
        discoveryMock(); page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        expect(await screen.findByRole('link', { name: /Football Ground · Venue · Rustavi/ })).toHaveAttribute('href', '/stadiums/22');
        expect(screen.getByText('From 80 GEL/hour · Owner approval')).toBeVisible();
        fireEvent.click(screen.getByRole('link', { name: 'Availability & booking' }));
        expect(screen.getByTestId('destination')).toHaveTextContent('"pathname":"/stadiums/22"');
        expect(screen.getByTestId('destination')).toHaveTextContent('"search":"?book=1"');
    });
    it('sends organization location and activity filters to the server and hides prior matches immediately', async () => {
        discoveryMock(); page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        await screen.findByRole('link', { name: /Football Partners · Organization/ });
        fireEvent.change(screen.getByRole('combobox', { name: 'Search in' }), { target: { value: 'ORGANIZATION' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'City or address' }), { target: { value: 'Kutaisi' } });
        expect(screen.queryByRole('link', { name: /Football Partners · Organization/ })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Activity' }), { target: { value: 'VENUE' } });
        await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/organizations/discovery', expect.objectContaining({ params: { q: 'Football', kind: 'ORGANIZATION', location: 'Kutaisi', activity: 'VENUE', limit: 5 }, _authSessionId: 'search-session' })));
    });
    it('keeps useful matches after a partial failure and allows retry', async () => {
        discoveryMock(true); page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        await screen.findByRole('link', { name: /Football Partners · Organization/ });
        expect(screen.getByText('Some search results are unavailable.')).toBeVisible();
        discoveryMock(); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() => expect(screen.queryByText('Some search results are unavailable.')).not.toBeInTheDocument());
    });
    it('offers retry when all sources fail without falsely saying no results', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(new Error('offline'));
        page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        expect(await screen.findByText('search.loadFailed')).toBeVisible();
        expect(screen.queryByText('search.noResults')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    });
    it('ranks an exact organization name before a less relevant person result', async () => {
        vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/tournaments/discovery' ? { items: [], total: 0, hasMore: false } : path === '/users/search' ? { content: [{ id: 45, fullName: 'Another Football Person' }] } : path === '/organizations/discovery' ? { ...emptyDiscovery, organizations: [company] } : [] }));
        page(); const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Football Partners' } });
        await screen.findByRole('link', { name: /Football Partners · Organization/ });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByTestId('destination')).toHaveTextContent('/organizations/21');
    });
    it('clears results and cancels outstanding work when the account changes', async () => {
        discoveryMock(); const view = page(); fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Football' } });
        await screen.findByRole('link', { name: /Football Partners · Organization/ });
        const request = vi.mocked(apiClient.get).mock.calls.find(([path]) => path === '/organizations/discovery');
        auth.sessionId = 'next-session';
        view.rerender(<MemoryRouter><GlobalSearchBar mobile /><Destination /></MemoryRouter>);
        expect(screen.getByRole('textbox')).toHaveValue('');
        expect(screen.queryByRole('link', { name: /Football Partners · Organization/ })).not.toBeInTheDocument();
        expect(request?.[1]?.signal?.aborted).toBe(true);
    });
    it('does not reopen a dismissed dropdown when an outstanding search finishes', async () => {
        let finish!: (value: { data: typeof emptyDiscovery }) => void;
        vi.mocked(apiClient.get).mockImplementation(path => path === '/organizations/discovery' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: path === '/tournaments/discovery' ? { items: [], total: 0, hasMore: false } : path === '/users/search' ? { content: [] } : [] }));
        page(); const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'Football' } });
        await waitFor(() => expect(finish).toBeDefined()); fireEvent.keyDown(input, { key: 'Escape' });
        await act(async () => { finish({ data: emptyDiscovery }); });
        expect(screen.queryByRole('region', { name: 'Search results' })).not.toBeInTheDocument();
    });
});
