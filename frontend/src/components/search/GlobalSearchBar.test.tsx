import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { GlobalSearchBar } from './GlobalSearchBar';
import { apiClient } from '../../api/axiosConfig';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 }, sessionId: 'search-session' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn() } }));
function Destination() { const location = useLocation(); return <output data-testid="destination">{JSON.stringify(location)}</output>; }
const page = () => render(<MemoryRouter><GlobalSearchBar mobile /><Destination /></MemoryRouter>);
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path === '/users/search' ? { content: [{ id: 45, fullName: 'Giorgi Beridze', username: 'giorgi' }] } : [] }));
});
afterEach(cleanup);
describe('Search and Dola handoff', () => {
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
});
