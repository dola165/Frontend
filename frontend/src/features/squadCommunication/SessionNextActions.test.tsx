import i18n from '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionNextActions } from './SessionNextActions';
import { CoachNextActions } from './CoachNextActions';
import { sessionEvent } from './useSquadSchedule';
import type { SquadOverview, SquadSession } from './api';

const event = (response: string) => sessionEvent({ id: 11, name: 'U14' }, { id: 1, title: 'Private session', starts_at: '2099-09-20T10:00:00Z', ends_at: '2099-09-20T11:00:00Z', status: 'SCHEDULED', attendance: [{ id: 61, name: 'Nika', response, active: true }] } as SquadSession);
afterEach(async () => { await i18n.changeLanguage('en'); });
it('takes a parent directly to the session that needs reconfirmation', () => {
    const select = vi.fn();const changed = event('RECONFIRMATION_REQUIRED');
    render(<SessionNextActions events={[changed]} canManage={false} playerId={61} onSelect={select}/>);
    expect(screen.getByRole('heading', { name: 'Plans changed — confirm again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review & reply' }));expect(select).toHaveBeenCalledWith(changed);
});
it('does not count another child or cancelled event as an outstanding reply', () => {
    render(<SessionNextActions events={[{ ...event('UNANSWERED'), status: 'CANCELLED' }]} canManage={false} playerId={61} onSelect={vi.fn()}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('uses Georgian copy for the new next-action surface', async () => {
    await i18n.changeLanguage('ka');
    render(<SessionNextActions events={[event('UNANSWERED')]} canManage={false} playerId={61} onSelect={vi.fn()}/>);
    expect(screen.getByRole('heading', { name: 'საჭიროა თქვენი პასუხი' })).toBeInTheDocument();
});
it('links a coach to response gaps, acknowledgements and their existing private inbox', () => {
    render(<MemoryRouter><CoachNextActions space={{ id: 11, can_manage: true, attention: { upcoming_sessions: 3, replies_needed: 2, acknowledgements_needed: 4 }, threads: [{ user_id: 10, unread_count: 1 }] } as SquadOverview}/></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Plan sessions & review replies' })).toHaveAttribute('href', '/squads/11?tab=sessions');
    expect(screen.getByRole('link', { name: '4 update acknowledgements pending' })).toHaveAttribute('href', '#coach-updates');
    expect(screen.getByRole('link', { name: '1 unread family conversations' })).toBeInTheDocument();
});
