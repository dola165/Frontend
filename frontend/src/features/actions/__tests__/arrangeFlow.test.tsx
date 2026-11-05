import '../../../i18n';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { Match } from '../../matchExchange/api';
import { ArrangeFlow } from '../flows/MatchFlows';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 }, sessionId: 'flow' }) }));
// The form itself has its own tests: here it shows which way and club it opened on, and sends what a test gives it.
const sent = vi.hoisted(() => ({ match: null as unknown }));
vi.mock('../../matchExchange/arrange/ArrangeMatchForm', () => ({
    ArrangeMatchForm: ({ mode, opponentId, head, storageKey, onSent }: { mode: string; opponentId?: number; head?: ReactNode; storageKey: string; onSent: (match: unknown) => void }) =>
        <div>{head}<p data-key={storageKey}>{`Form ${mode}${opponentId ? ` with club ${opponentId}` : ''}`}</p><button type="button" onClick={() => onSent(sent.match)}>Send</button></div>,
}));

afterEach(() => { cleanup(); sessionStorage.clear(); });
function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname + location.search}</output>; }
const show = (props: Partial<Parameters<typeof ArrangeFlow>[0]>, onClose = vi.fn()) => {
    render(<MemoryRouter initialEntries={['/clubs/4']}><Routes><Route path="*" element={<><ArrangeFlow onClose={onClose} {...props} /><Where /></>} /></Routes></MemoryRouter>);
    return onClose;
};

it('asks first how to find an opponent when the door does not know, each way with its own form', () => {
    show({ opponentId: 4 });
    expect(screen.queryByText(/^Form/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open challenge/ }));
    // An open challenge has no opponent, even from a club's page.
    expect(screen.getByText('Form open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open challenge', pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Invite a club' }));
    expect(screen.getByText('Form direct with club 4')).toBeInTheDocument();
});

it('opens on the way the door pre-chose: Play them again invites that club, World posts an open challenge', () => {
    show({ opponentId: 4, way: 'invite' });
    expect(screen.getByText('Form direct with club 4')).toBeInTheDocument();
    cleanup();
    show({ way: 'open' });
    expect(screen.getByText('Form open')).toBeInTheDocument();
});

it('stays where the person was once sent, saying what happened with the match one tap away', () => {
    sent.match = { event_id: 9, squad_id: 103, listing_status: 'ARRANGED', requested_club_id: null, outside_opponent: 'Gori Juniors', opponent_name: null } as Partial<Match>;
    const onClose = show({ way: 'invite', squadId: 103 });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('dialog', { name: 'Match against Gori Juniors added' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the match' })).toHaveAttribute('href', '/matches/9?from=squad%3A103');
    expect(screen.getByTestId('where')).toHaveTextContent('/clubs/4');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    sent.match = { event_id: 10, squad_id: 103, listing_status: 'OPEN', requested_club_id: 4 } as Partial<Match>;
    show({ way: 'invite', opponentId: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('dialog', { name: 'Invitation sent' })).toBeInTheDocument();
});

it('resumes an invitation drafted before step 6, with its request id, from Continue (fix round 1)', () => {
    // Release 16 kept it under `direct.c7.s103`; today's key is `invite.c7.s103`.
    sessionStorage.setItem('gk:arrange:1:flow:direct.c7.s103', JSON.stringify({ title: 'Friendly v Saburtalo', time: '11:00', requestId: 'sent-once', savedAt: 5 }));
    show({});
    fireEvent.click(screen.getByRole('button', { name: /Friendly v Saburtalo/ }));
    expect(screen.getByText('Form direct with club 7')).toHaveAttribute('data-key', 'gk:arrange:1:flow:invite.c7.s103');
    expect(JSON.parse(sessionStorage.getItem('gk:arrange:1:flow:invite.c7.s103') ?? '{}').requestId).toBe('sent-once');
    expect(sessionStorage.getItem('gk:arrange:1:flow:direct.c7.s103')).toBeNull();
});

it('keeps a newer draft and offers the older one under its own key; My squads’ own old form resumes too', () => {
    sessionStorage.setItem('gk:arrange:1:flow:invite.c7.s103', JSON.stringify({ title: 'Newer plan', requestId: 'new', savedAt: 9 }));
    sessionStorage.setItem('gk:arrange:1:flow:direct.c7.s103', JSON.stringify({ title: 'Older plan', requestId: 'old', savedAt: 3 }));
    sessionStorage.setItem('gk:arrange:1:flow:coach-105', JSON.stringify({ title: 'U16 friendly', requestId: 'coach', savedAt: 1 }));
    show({});
    expect(screen.getAllByRole('button', { name: /plan|friendly/ }).map(button => button.textContent)).toEqual(['Newer plan', 'Older plan', 'U16 friendly']);
    fireEvent.click(screen.getByRole('button', { name: /Older plan/ }));
    expect(screen.getByText('Form direct with club 7')).toHaveAttribute('data-key', 'gk:arrange:1:flow:direct.c7.s103');
    cleanup();
    show({});
    fireEvent.click(screen.getByRole('button', { name: /U16 friendly/ }));
    expect(screen.getByText('Form direct')).toHaveAttribute('data-key', 'gk:arrange:1:flow:invite.s105');
});
