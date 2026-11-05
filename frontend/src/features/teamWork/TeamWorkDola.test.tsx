import '../../i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as dola from '../dola/agentDola';
import { openAgentDola } from '../dola/agentDolaEvents';
import { currentGuide, goToStep, startGuide, stopGuide } from '../dola/dolaGuide';
import { normalizeAgentDolaReply } from '../dola/agentDola';
import { TeamWorkDola } from './TeamWorkDola';

const auth = vi.hoisted(() => ({ team: true }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, navigationCapabilities: { version: 1,
    workspaces: auth.team ? [{ id: 'team.work', context: { type: 'user', id: 1, label: 'Team work' } }] : [] } } }) }));
vi.mock('../dola/agentDola', async importOriginal => ({
    ...await importOriginal<typeof dola>(), agentDolaStatus: vi.fn(), agentDolaConversation: vi.fn(), sendAgentDola: vi.fn(), decideAgentDola: vi.fn(), forgetAgentDola: vi.fn(),
    uploadAgentDolaPicture: vi.fn(),
}));

const ACTION = '0b7a3c1e-1111-4222-8333-944455556666';
const reply = (extra: Partial<dola.AgentDolaReply>): dola.AgentDolaReply => ({
    status: 'INFO', reply: '', tool: null, actionId: null, proposal: null, cards: [], navigation: null, quickReplies: [], language: 'en', trace: null,
    sources: [], guide: null, ...extra,
});
const mount = (onChanged = vi.fn(), at = '/team-work?step=12') => render(<MemoryRouter initialEntries={[at]}><TeamWorkDola onChanged={onChanged} /></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    auth.team = true;
    window.localStorage.clear();
    vi.mocked(dola.agentDolaConversation).mockResolvedValue([]);
});

it('shows what Dola is doing, then its words as they come, then the finished answer', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: true, reason: null, welcome: 'Hi', examples: [] });
    let progress: dola.AgentDolaProgress | undefined;
    let finish: (answer: dola.AgentDolaReply) => void = () => undefined;
    vi.mocked(dola.sendAgentDola).mockImplementation((_message, _path, _options, watching) => {
        progress = watching;
        return new Promise(resolve => { finish = resolve; });
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    fireEvent.change(await screen.findByLabelText('Message to Dola'), { target: { value: 'how do I book a pitch?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Dola is thinking…')).toBeInTheDocument();

    act(() => progress?.step('Checking your calendar…'));
    expect(screen.getByRole('status')).toHaveTextContent('Checking your calendar…');
    expect(screen.queryByText('Dola is thinking…')).not.toBeInTheDocument();

    act(() => { progress?.words('Open the **venue'); });
    expect(screen.getByText(/Open the venue/)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    expect(screen.queryByText('Checking your calendar…')).not.toBeInTheDocument();
    act(() => { progress?.words('** page.'); });
    expect(screen.getByText('venue').tagName).toBe('STRONG');

    await act(async () => finish(reply({ status: 'CHAT', reply: 'The finished answer.' })));
    expect(await screen.findByText('The finished answer.')).toBeInTheDocument();
    expect(screen.queryByText(/Open the/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('shows nothing when Dola does not exist for this account', async () => {
    vi.mocked(dola.agentDolaStatus).mockRejectedValue({ response: { status: 404 } });
    const { container } = mount();
    await waitFor(() => expect(dola.agentDolaStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
});

it('previews a change, runs it only on approval and reloads the board', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({
        status: 'ACTION_CONFIRMATION_REQUIRED', reply: 'I\'ll move GK-12 “Login page” to Needs your look. Shall I?', tool: 'change_status', actionId: ACTION,
        proposal: { title: 'Change a task\'s status', confirmLabel: 'Move it', expiresAt, details: [{ label: 'Status', value: 'In progress → Needs your look' }] },
    }));
    vi.mocked(dola.decideAgentDola).mockResolvedValue(reply({
        status: 'ACTION_COMPLETED', reply: 'Moved GK-12 “Login page” to Needs your look.', actionId: ACTION,
        cards: [{ title: 'GK-12 Login page', subtitle: 'Needs your look', link: { label: 'GK-12 Login page', webPath: '/team-work?step=12' } }],
    }));
    const onChanged = vi.fn();
    mount(onChanged);
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'move this to needs your look{Enter}');

    expect(dola.sendAgentDola).toHaveBeenCalledWith('move this to needs your look', '/team-work?step=12', { trace: false }, expect.anything());
    expect(await screen.findByText('In progress → Needs your look')).toBeInTheDocument();
    expect(screen.getByText(/Nothing has changed yet/)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Move it' }));
    expect(dola.decideAgentDola).toHaveBeenCalledWith(ACTION, 'confirm', { trace: false });
    expect(await screen.findByText(/Moved GK-12/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GK-12 Login page/ })).toHaveAttribute('href', '/team-work?step=12');
    expect(screen.queryByRole('button', { name: 'Move it' })).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
});

it('lets a match cancellation be approved and shows the page and web sources an answer brings', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    vi.mocked(dola.sendAgentDola)
        .mockResolvedValueOnce(reply({
            status: 'CONFIRMATION_REQUIRED', reply: 'Cancel FC Dinamo Tbilisi vs Torpedo tomorrow at 18:00?', tool: 'cancel_match', actionId: ACTION,
            proposal: { title: 'Cancel a match', confirmLabel: 'Confirm', expiresAt, details: [{ label: 'Will be told', value: '18 players, 1 coaches, 2 club staff' }] },
        }))
        .mockResolvedValueOnce(reply({ status: 'INFO', reply: 'Here is your calendar.', navigation: { label: 'Calendar', webPath: '/calendar' } }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'cancel tomorrow\'s match{Enter}');
    expect(await screen.findByText('18 players, 1 coaches, 2 club staff')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'open the calendar{Enter}');
    expect(await screen.findByRole('link', { name: /Open Calendar/ })).toHaveAttribute('href', '/calendar');

    const web = normalizeAgentDolaReply({ status: 'WEB_RESULTS', reply: 'x', sources: [
        { title: 'Laws of the Game', url: 'https://www.theifab.com/laws', snippet: 'Law 11' }, { title: 'Bad', url: 'javascript:alert(1)' }] });
    expect(web.sources).toEqual([{ title: 'Laws of the Game', url: 'https://www.theifab.com/laws', snippet: 'Law 11' }]);
});

it('starts a guide from a reply: opens its page and steps aside so the fields can be seen', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    const guide = { title: 'Your profile', webPath: '/account?tab=profile', scan: false,
        steps: [{ target: 'bio', label: 'Bio', hint: null, required: false }, { target: 'save', label: 'Save', hint: null, required: true }] };
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({ reply: 'Your profile is missing 1 thing.', tool: 'guide_me', guide }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'help me fill out my profile{Enter}');

    await waitFor(() => expect(currentGuide()?.guide.title).toBe('Your profile'));
    expect(screen.queryByRole('dialog', { name: 'Agent Dola' })).not.toBeInTheDocument();
    stopGuide();
});

it('opens from the header on any page', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    mount(vi.fn(), '/account?tab=profile');
    await waitFor(() => expect(dola.agentDolaStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Ask Dola' })).not.toBeInTheDocument();
    window.dispatchEvent(new Event('agent-dola:open'));
    expect(await screen.findByRole('dialog', { name: 'Agent Dola' })).toBeInTheDocument();
});

it('says so when Dola is switched off, and keeps the board usable', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: false, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    expect(screen.getByText(/switched off/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message to Dola' })).toBeDisabled();
});

it('never turns a foreign link or a malformed action id into something clickable', () => {
    const normalized = normalizeAgentDolaReply({
        status: 'ACTION_CONFIRMATION_REQUIRED', reply: 'x', actionId: 'not-an-id', proposal: { title: 't', details: [], confirmLabel: 'Go', expiresAt: '' },
        cards: [{ title: 'Elsewhere', link: { label: 'Elsewhere', webPath: 'https://evil.example/' } }, { title: 'Protocol-relative', link: { label: 'x', webPath: '//evil.example' } }],
    });
    expect(normalized.actionId).toBeNull();
    expect(normalized.proposal).toBeNull();
    expect(normalized.cards.map(card => card.link?.webPath)).toEqual([null, null]);
});

it('shows how Dola understood a reply only after the person turns it on, and remembers the choice', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({
        status: 'NEEDS_CLARIFICATION', reply: 'What should the task be called?', tool: 'create_task',
        trace: { route: 'create_task', confidence: 0.91, runnerUp: 'find_task', direct: 0.88, slots: [{ name: 'plan', value: 'ideas' }],
            jevCalls: 2, writerCalls: 0, millis: 640, why: 'create_task is missing a detail: title.' },
    }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    const toggle = screen.getByRole('button', { name: 'Show how Dola understood each reply' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('gk.teamWork.dolaTrace')).toBe('on');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'add a task{Enter}');
    expect(dola.sendAgentDola).toHaveBeenCalledWith('add a task', '/team-work?step=12', { trace: true }, expect.anything());

    const fold = (await screen.findByText('How Dola understood this')).closest('details')!;
    expect(fold).not.toHaveAttribute('open');
    await userEvent.click(screen.getByText('How Dola understood this'));
    expect(fold).toHaveTextContent('create_task · 0.91 · next find_task');
    expect(fold).toHaveTextContent('Instruction0.88');
    expect(fold).toHaveTextContent('plan ideas');
    expect(fold).toHaveTextContent('2 Jev · 0 writer · 640 ms');
    expect(fold).toHaveTextContent('create_task is missing a detail: title.');
});

it('opens the panel when the header link brings the person here', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    mount(vi.fn(), '/team-work?dola=open');
    expect(await screen.findByRole('dialog', { name: 'Agent Dola' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Agent Dola' })).not.toBeInTheDocument();
});

it.each([
    ['SWITCHED_OFF', /switched off on this server \(DOLA_ENABLED\)/],
    ['NO_LANGUAGE_KEY', /TYPESAFE_API_KEY isn’t set on this server/],
    ['LANGUAGE_KEY_REJECTED', /rejected this server’s key/],
])('tells the team exactly why Dola is unavailable (%s)', async (reason, text) => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: false, maxMessageLength: 8000, writer: false, reason, welcome: '', examples: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    expect(screen.getByText(text)).toBeInTheDocument();
});

it('keeps only the trace fields it understands', () => {
    const normalized = normalizeAgentDolaReply({ status: 'INFO', reply: 'x', trace: { route: 'waiting_on_me', confidence: 'high', slots: { task: '142', bad: 3 }, jevCalls: -1, millis: 12.4 } });
    expect(normalized.trace).toEqual({ route: 'waiting_on_me', confidence: null, runnerUp: null, direct: null, slots: [{ name: 'task', value: '142' }],
        jevCalls: 0, writerCalls: 0, millis: 12, why: null });
    expect(normalizeAgentDolaReply({ status: 'INFO', reply: 'x' }).trace).toBeNull();
});

it('opens from the guide over the form, says which field the question is about, and closes back to it', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({ status: 'HELP', reply: '**Ground** — Where it’s played.' }));
    startGuide({ title: 'Create a tournament', webPath: '/world/tournaments?peek=draw-new', scan: false, steps: [
        { target: 'draw-start', label: 'Starts', hint: null, required: true },
        { target: 'draw-venue', label: 'Ground', hint: null, required: false },
    ] });
    goToStep(1);
    mount(vi.fn(), '/world/tournaments?peek=draw-new');
    await waitFor(() => expect(dola.agentDolaStatus).toHaveBeenCalled());

    act(() => openAgentDola());
    // Directly under <body>, as a dialog's companion: usable while World's drawer keeps the page inert.
    expect(document.body.querySelector(':scope > [data-dialog-companion] .tw-dola')).not.toBeNull();
    expect(screen.getByText('Create a tournament · step 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message to Dola' })).toHaveAttribute('placeholder', 'Ask about “Ground” or anything else…');

    await userEvent.click(screen.getByRole('button', { name: 'What is “Ground”?' }));
    expect(dola.sendAgentDola).toHaveBeenCalledWith('What is “Ground”?', '/world/tournaments?peek=draw-new', { trace: false }, expect.anything());
    expect(await screen.findByText('Ground', { selector: 'strong', ignore: '.tw-dola__about strong' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Agent Dola' })).not.toBeInTheDocument();
    expect(currentGuide()?.index).toBe(1);
    stopGuide();
});

it('opened with a question (a first-time tip’s “Help me”), asks it once the earlier conversation is in', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    let history: (turns: Awaited<ReturnType<typeof dola.agentDolaConversation>>) => void = () => undefined;
    vi.mocked(dola.agentDolaConversation).mockReturnValue(new Promise(resolve => { history = resolve; }));
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({ status: 'INFO', reply: 'Clubs near Rustavi:', tool: 'find_clubs' }));
    mount(vi.fn(), '/world/clubs');
    await waitFor(() => expect(dola.agentDolaStatus).toHaveBeenCalled());

    act(() => openAgentDola('Find clubs near me'));
    expect(screen.getByRole('dialog', { name: 'Agent Dola' })).toBeInTheDocument();
    // Not before the earlier conversation is shown: the question goes below it, not in its place.
    expect(dola.sendAgentDola).not.toHaveBeenCalled();
    await act(async () => history([{ message: 'What’s on my schedule this week?', answer: reply({ reply: 'Nothing this week.' }), at: '2026-11-01T09:00:00Z' }]));

    await waitFor(() => expect(dola.sendAgentDola).toHaveBeenCalledWith('Find clubs near me', '/world/clubs', { trace: false }, expect.anything()));
    expect(await screen.findByText('Clubs near Rustavi:')).toBeInTheDocument();
    expect(screen.getByText('Nothing this week.')).toBeInTheDocument();
    expect(dola.sendAgentDola).toHaveBeenCalledTimes(1);

    // The header's plain open asks nothing.
    act(() => openAgentDola());
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));
    expect(dola.sendAgentDola).toHaveBeenCalledTimes(1);
});

it('gives a customer their own welcome and examples, with no Team work hint and no trace switch', async () => {
    auth.team = false;
    window.localStorage.setItem('gk.teamWork.dolaTrace', 'on');
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null,
        welcome: 'I’m Dola. I show your schedule, find clubs and tryouts for your child.', examples: ['Show open tryouts'] });
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({ status: 'INFO', reply: 'Open tryouts:' }));
    mount(vi.fn(), '/home?dola=open');
    expect(await screen.findByText(/find clubs and tryouts for your child/)).toBeInTheDocument();
    expect(dola.agentDolaStatus).toHaveBeenCalledWith(expect.anything(), 'en');
    expect(screen.queryByRole('button', { name: 'Show how Dola understood each reply' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message to Dola' })).not.toHaveAttribute('placeholder', expect.stringContaining('report'));
    await userEvent.click(screen.getByRole('button', { name: 'Show open tryouts' }));
    expect(dola.sendAgentDola).toHaveBeenCalledWith('Show open tryouts', '/home', { trace: false }, expect.anything());
});

it('tells a customer plainly when Dola is off, without the server’s settings', async () => {
    auth.team = false;
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: false, maxMessageLength: 8000, writer: false, reason: 'NO_LANGUAGE_KEY',
        welcome: '', examples: [] });
    mount(vi.fn(), '/home?dola=open');
    expect(await screen.findByText(/Agent Dola isn’t available right now/)).toBeInTheDocument();
    expect(screen.queryByText(/TYPESAFE_API_KEY/)).not.toBeInTheDocument();
});

it('counts a two-hour preview down in hours', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    const expiresAt = new Date(Date.now() + 2 * 60 * 60_000 - 500).toISOString();
    vi.mocked(dola.sendAgentDola).mockResolvedValue(reply({
        status: 'ACTION_CONFIRMATION_REQUIRED', reply: 'Cancel it?', tool: 'cancel_match', actionId: ACTION,
        proposal: { title: 'Cancel a match', confirmLabel: 'Cancel match', expiresAt, details: [] },
    }));
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Ask Dola' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'cancel it{Enter}');
    expect(await screen.findByText(/Waits 1:59:5\d/)).toBeInTheDocument();
});

it('sends a picture with or without words, shows it in the chat and on the preview it is used in', async () => {
    auth.team = false;
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '',
        examples: [], pictures: true, readsPictures: false });
    vi.mocked(dola.uploadAgentDolaPicture).mockResolvedValue({ id: 5, url: '/uploads/dola-abc.jpg' });
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    vi.mocked(dola.sendAgentDola)
        .mockResolvedValueOnce(reply({ status: 'NEEDS_CLARIFICATION', reply: 'What should I do with this picture?',
            quickReplies: ['Make it my profile photo', 'Post it to the feed'] }))
        .mockResolvedValueOnce(reply({ status: 'ACTION_CONFIRMATION_REQUIRED', reply: 'Make this picture your profile photo?', tool: 'use_picture',
            actionId: ACTION, proposal: { title: 'Use a picture you send', confirmLabel: 'Use this picture', expiresAt, details: [],
                pictureUrl: '/uploads/dola-abc.jpg' } }));
    mount(vi.fn(), '/home?dola=open');
    const send = await screen.findByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Send a picture' }));
    const file = new File(['jpeg'], 'poster.jpg', { type: 'image/jpeg' });
    await userEvent.upload(document.querySelector<HTMLInputElement>('.tw-dola__compose input[type=file]')!, file);
    expect(dola.uploadAgentDolaPicture).toHaveBeenCalledWith(file);
    expect(await screen.findByRole('img', { name: 'Picture to send' })).toHaveAttribute('src', expect.stringContaining('/uploads/dola-abc.jpg'));

    await userEvent.click(send);
    expect(dola.sendAgentDola).toHaveBeenCalledWith('', '/home', { trace: false, pictureId: 5 }, expect.anything());
    expect(await screen.findByText('What should I do with this picture?')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Your picture' })).toHaveAttribute('src', expect.stringContaining('/uploads/dola-abc.jpg'));
    expect(screen.queryByRole('img', { name: 'Picture to send' })).not.toBeInTheDocument();

    // A tapped choice is about the picture already sent: it never sends it again.
    await userEvent.click(screen.getByRole('button', { name: 'Make it my profile photo' }));
    expect(dola.sendAgentDola).toHaveBeenLastCalledWith('Make it my profile photo', '/home', { trace: false, pictureId: undefined }, expect.anything());
    expect(await screen.findByRole('img', { name: 'The picture you sent' })).toHaveAttribute('src', expect.stringContaining('/uploads/dola-abc.jpg'));
    expect(screen.getByRole('button', { name: 'Use this picture' })).toBeInTheDocument();
});

it('keeps a picture that did not go, and can take it off before sending', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '',
        examples: [], pictures: true });
    vi.mocked(dola.uploadAgentDolaPicture).mockResolvedValue({ id: 7, url: '/uploads/dola-def.jpg' });
    vi.mocked(dola.sendAgentDola).mockRejectedValueOnce(new Error('offline'));
    mount(vi.fn(), '/home?dola=open');
    await screen.findByRole('button', { name: 'Send' });
    await userEvent.upload(document.querySelector<HTMLInputElement>('.tw-dola__compose input[type=file]')!, new File(['x'], 'a.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: 'Picture to send' });

    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'post this{Enter}');
    expect(await screen.findByRole('img', { name: 'Picture to send' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message to Dola' })).toHaveValue('post this');

    await userEvent.click(screen.getByRole('button', { name: 'Remove the picture' }));
    expect(screen.queryByRole('img', { name: 'Picture to send' })).not.toBeInTheDocument();
});

it('offers no picture button where pictures can\'t be sent, and drops a picture address that is not an upload', () => {
    const normalized = normalizeAgentDolaReply({ status: 'ACTION_CONFIRMATION_REQUIRED', actionId: ACTION,
        proposal: { title: 't', confirmLabel: 'c', expiresAt: '2026-11-03T12:00:00Z', details: [], pictureUrl: 'https://evil.example/x.jpg' } });
    expect(normalized.proposal?.pictureUrl).toBeNull();
    const ours = normalizeAgentDolaReply({ status: 'ACTION_CONFIRMATION_REQUIRED', actionId: ACTION,
        proposal: { title: 't', confirmLabel: 'c', expiresAt: '2026-11-03T12:00:00Z', details: [], pictureUrl: '/uploads/dola-1.jpg' } });
    expect(ours.proposal?.pictureUrl).toBe('/uploads/dola-1.jpg');
});

it('has no picture button when the server does not take pictures', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    mount(vi.fn(), '/home?dola=open');
    await screen.findByRole('button', { name: 'Send' });
    expect(screen.queryByRole('button', { name: 'Send a picture' })).not.toBeInTheDocument();
});

it('words an answer’s buttons and links in the answer’s own language, never the site’s', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false, reason: null, welcome: '', examples: [] });
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    vi.mocked(dola.sendAgentDola)
        .mockResolvedValueOnce(reply({ status: 'ACTION_CONFIRMATION_REQUIRED', reply: 'გამოვაქვეყნო პოსტი?', language: 'ka', actionId: ACTION,
            proposal: { title: 'პოსტის გამოქვეყნება', confirmLabel: '', expiresAt, details: [] } }))
        .mockResolvedValueOnce(reply({ status: 'INFO', reply: 'Here it is:', language: 'en', navigation: { label: 'your post', webPath: '/posts/55' } }));
    mount(vi.fn(), '/home?dola=open');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Message to Dola' }), 'დაპოსტე{Enter}');

    expect(await screen.findByRole('button', { name: 'დადასტურება' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'გაუქმება' })).toBeInTheDocument();
    expect(screen.getByText(/ჯერ არაფერი შეცვლილა/)).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message to Dola' }), 'where is it{Enter}');
    expect(await screen.findByRole('link', { name: /Open your post/ })).toHaveAttribute('href', '/posts/55');
});

it('tells the team, and only the team, when the writer model’s account has no credit', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: true, reason: null, welcome: '',
        examples: [], writerProblem: 'NO_BALANCE' });
    const team = mount(vi.fn(), '/home?dola=open');
    expect(await screen.findByText(/account has no credit left \(HTTP 402\)/)).toBeInTheDocument();
    team.unmount();

    auth.team = false;
    mount(vi.fn(), '/home?dola=open');
    await screen.findByRole('button', { name: 'Send' });
    expect(screen.queryByText(/no credit left/)).not.toBeInTheDocument();
});
