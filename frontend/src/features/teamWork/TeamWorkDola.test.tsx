import '../../i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import * as dola from '../dola/agentDola';
import { normalizeAgentDolaReply } from '../dola/agentDola';
import { TeamWorkDola } from './TeamWorkDola';

vi.mock('../dola/agentDola', async importOriginal => ({
    ...await importOriginal<typeof dola>(), agentDolaStatus: vi.fn(), agentDolaConversation: vi.fn(), sendAgentDola: vi.fn(), decideAgentDola: vi.fn(), forgetAgentDola: vi.fn(),
}));

const ACTION = '0b7a3c1e-1111-4222-8333-944455556666';
const reply = (extra: Partial<dola.AgentDolaReply>): dola.AgentDolaReply => ({
    status: 'INFO', reply: '', tool: null, actionId: null, proposal: null, cards: [], navigation: null, quickReplies: [], language: 'en', ...extra,
});
const mount = (onChanged = vi.fn()) => render(<MemoryRouter initialEntries={['/team-work?step=12']}><TeamWorkDola onChanged={onChanged} /></MemoryRouter>);

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dola.agentDolaConversation).mockResolvedValue([]);
});

it('shows nothing when Dola does not exist for this account', async () => {
    vi.mocked(dola.agentDolaStatus).mockRejectedValue({ response: { status: 404 } });
    const { container } = mount();
    await waitFor(() => expect(dola.agentDolaStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
});

it('previews a change, runs it only on approval and reloads the board', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: true, maxMessageLength: 8000, writer: false });
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

    expect(dola.sendAgentDola).toHaveBeenCalledWith('move this to needs your look', '/team-work?step=12');
    expect(await screen.findByText('In progress → Needs your look')).toBeInTheDocument();
    expect(screen.getByText(/Nothing has changed yet/)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Move it' }));
    expect(dola.decideAgentDola).toHaveBeenCalledWith(ACTION, 'confirm');
    expect(await screen.findByText(/Moved GK-12/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GK-12 Login page/ })).toHaveAttribute('href', '/team-work?step=12');
    expect(screen.queryByRole('button', { name: 'Move it' })).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
});

it('says so when Dola is switched off, and keeps the board usable', async () => {
    vi.mocked(dola.agentDolaStatus).mockResolvedValue({ available: false, maxMessageLength: 8000, writer: false });
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
