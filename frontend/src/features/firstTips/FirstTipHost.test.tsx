import { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/axiosConfig';
import i18n from '../../i18n';
import { AGENT_DOLA_OPEN, openAgentDola, type AgentDolaOpenRequest } from '../dola/agentDolaEvents';
import { applyPreferencesUpdate, type Preferences, type PreferencesUpdate } from '../preferences/preferencesStore';
import { requestFirstTip, resetTips } from './firstTips';
import { FirstTipHost } from './FirstTipHost';

const server = vi.hoisted(() => ({ prefs: {} as Preferences, puts: [] as PreferencesUpdate[] }));
const auth = vi.hoisted(() => ({ user: { id: 0 } as { id: number; navigationCapabilities?: { version: number; workspaces: { id: string; context: { type: string; id: number; label: string } }[] } } }));
const dola = vi.hoisted(() => ({ entry: 'agent-dola' as 'agent-dola' | null }));
vi.mock('../../api/axiosConfig', async original => ({ ...(await original<object>()), apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session', status: 'authenticated' }) }));
vi.mock('../dola/dolaEntry', () => ({ useDolaEntry: () => dola.entry }));
vi.mock('./tipCatalog', () => {
    const words = (en: string, ka: string) => ({ en, ka });
    return {
        FIRST_TIPS: [
            { id: 'world', title: words('World', 'მსოფლიო'), body: words('Every club on one map.', 'ყველა კლუბი ერთ რუკაზე.'),
                ask: words('Find clubs near me', 'მოძებნე კლუბები ახლოს'), places: [{ path: '/world/*' }] },
            { id: 'create-tournament', title: words('Create a tournament', 'ტურნირის შექმნა'), body: words('The Draw room.', 'წილისყრის ოთახი.'),
                ask: words('Help me create a tournament', 'დამეხმარე ტურნირის შექმნაში'), places: [{ path: '/world/tournaments', query: { peek: 'draw-new' } }] },
            { id: 'post', title: words('Write a post', 'პოსტის დაწერა'), body: words('Share with followers.', 'გაუზიარეთ მიმდევრებს.'),
                ask: words('Help me write a post', 'დამეხმარე პოსტის დაწერაში') },
            { id: 'my-squads', title: words('My squads', 'ჩემი გუნდები'), body: words('Your teams.', 'თქვენი გუნდები.'),
                ask: words('Send a message to my players', 'მოთამაშეებს შეტყობინება გაუგზავნე'), askFor: 'staff', places: [{ path: '/my-squads' }] },
        ],
    };
});

let nextUser = 9100;
const router: { navigate: (to: string) => void } = { navigate: () => undefined };
const go = (to: string) => router.navigate(to);
function Navigator() {
    const navigate = useNavigate();
    useEffect(() => { router.navigate = to => { void navigate(to); }; }, [navigate]);
    return null;
}
function mount(entry: string) {
    render(<MemoryRouter initialEntries={[entry]}>
        <FirstTipHost /><Navigator />
        <button type="button" data-first-tip="post">Write a post</button>
    </MemoryRouter>);
}
const tip = (name: string) => screen.findByRole('dialog', { name }, { timeout: 3000 });
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 900)));
const saved = () => server.prefs.tutorials?.completed ?? [];

beforeEach(async () => {
    await i18n.changeLanguage('en');
    auth.user = { id: nextUser++ };
    dola.entry = 'agent-dola';
    server.prefs = {};
    server.puts = [];
    vi.mocked(apiClient.get).mockImplementation(async () => ({ data: server.prefs }));
    vi.mocked(apiClient.put).mockImplementation(async (_url: string, body?: unknown) => {
        server.puts.push(body as PreferencesUpdate);
        server.prefs = applyPreferencesUpdate(server.prefs, body as PreferencesUpdate);
        return { data: server.prefs };
    });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('FirstTipHost', () => {
    it('explains a page on the first visit only, and remembers it on the server', async () => {
        const user = userEvent.setup();
        mount('/world/clubs');
        expect(await tip('World')).toHaveTextContent('Every club on one map.');
        await waitFor(() => expect(saved()).toContain('tip-world'));
        await user.click(screen.getByRole('button', { name: 'Got it' }));
        expect(screen.queryByRole('dialog')).toBeNull();

        act(() => go('/home'));
        act(() => go('/world/venues'));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows a page’s own tip before its section’s, one per visit', async () => {
        mount('/world/tournaments?peek=draw-new');
        expect(await tip('Create a tournament')).toBeInTheDocument();
        await settle();
        expect(screen.queryByRole('dialog', { name: 'World' })).toBeNull();
    });

    it('closes a page’s tip when the person moves to a page it does not explain', async () => {
        mount('/world/clubs');
        await tip('World');
        act(() => go('/home'));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('explains an action the first time it is clicked or asked for', async () => {
        const user = userEvent.setup();
        mount('/home');
        await user.click(screen.getByRole('button', { name: 'Write a post' }));
        expect(await tip('Write a post')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Close tip' }));
        await user.click(screen.getByRole('button', { name: 'Write a post' }));
        act(() => requestFirstTip('post'));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('a click before the person’s settings are in still gets its tip once they arrive', async () => {
        const user = userEvent.setup();
        let answer: (value: { data: Preferences }) => void = () => undefined;
        vi.mocked(apiClient.get).mockImplementation(() => new Promise(resolve => { answer = resolve; }));
        mount('/messages');
        await user.click(screen.getByRole('button', { name: 'Write a post' }));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
        await act(async () => answer({ data: server.prefs }));
        expect(await tip('Write a post')).toBeInTheDocument();
    });

    it('“Help me” opens Agent Dola with the question on the button', async () => {
        const user = userEvent.setup();
        const asked: (string | undefined)[] = [];
        const listen = (event: Event) => asked.push((event as CustomEvent<AgentDolaOpenRequest>).detail?.ask);
        window.addEventListener(AGENT_DOLA_OPEN, listen);
        mount('/world/clubs');
        await tip('World');
        expect(screen.getByText('Want a hand? I can do it with you:')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Find clubs near me' }));
        expect(asked).toEqual(['Find clubs near me']);
        expect(screen.queryByRole('dialog')).toBeNull();
        window.removeEventListener(AGENT_DOLA_OPEN, listen);
    });

    it('offers a staff-only “Help me” to club staff only; anyone else gets the tip with nothing to ask', async () => {
        mount('/my-squads');
        await tip('My squads');
        expect(screen.queryByRole('button', { name: 'Send a message to my players' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    });

    it('a coach is offered the staff-only “Help me”', async () => {
        auth.user = { id: nextUser++, navigationCapabilities: { version: 1, workspaces: [{ id: 'club.workspace', context: { type: 'club', id: 1, label: 'Dinamo' } }] } };
        mount('/my-squads');
        await tip('My squads');
        expect(screen.getByRole('button', { name: 'Send a message to my players' })).toBeInTheDocument();
    });

    it('puts the tip away when Agent Dola opens', async () => {
        mount('/world/clubs');
        await tip('World');
        act(() => openAgentDola());
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('without Agent Dola it still explains, with nothing to ask', async () => {
        dola.entry = null;
        mount('/world/clubs');
        await tip('World');
        expect(screen.getByText('Quick tip')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Find clubs near me' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    });

    it('turned off, no tip shows until they are asked for again', async () => {
        const user = userEvent.setup();
        mount('/world/clubs');
        await tip('World');
        await user.click(screen.getByRole('button', { name: 'Don’t show tips like this' }));
        await waitFor(() => expect(saved()).toContain('tips-off'));
        act(() => go('/world/tournaments?peek=draw-new'));
        await user.click(screen.getByRole('button', { name: 'Write a post' }));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();

        await act(() => resetTips(auth.user.id));
        expect(saved()).toEqual([]);
        act(() => go('/world/clubs'));
        expect(await tip('World')).toBeInTheDocument();
    });

    it('waits while the welcome after sign-up is open', async () => {
        mount('/home?welcome=roles');
        act(() => go('/world/clubs?welcome=roles'));
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
        act(() => go('/world/clubs'));
        expect(await tip('World')).toBeInTheDocument();
    });

    it('a tip seen on another device does not show again', async () => {
        server.prefs = { tutorials: { completed: ['calendar', 'tip-world'] } };
        mount('/world/clubs');
        await settle();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('speaks Georgian when the app does', async () => {
        await i18n.changeLanguage('ka');
        mount('/world/clubs');
        expect(await tip('მსოფლიო')).toHaveTextContent('ყველა კლუბი ერთ რუკაზე.');
        expect(screen.getByRole('button', { name: 'მოძებნე კლუბები ახლოს' })).toBeInTheDocument();
    });
});
