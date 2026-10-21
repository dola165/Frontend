import i18n from '../../i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionNextActions } from './SessionNextActions';
import { sessionEvent } from './useSquadSchedule';
import type { SquadSession } from './api';

const event = (response: string, asking = false) => sessionEvent({ id: 11, name: 'U14' }, { id: 1, title: 'Private session', starts_at: '2099-09-20T10:00:00Z', ends_at: '2099-09-20T11:00:00Z', status: 'SCHEDULED', response_requested: asking, attendance: [{ id: 61, name: 'Nika', response, active: true }] } as SquadSession);
afterEach(async () => { await i18n.changeLanguage('en'); });
it('takes a parent directly to the session that needs reconfirmation', () => {
    const select = vi.fn();const changed = event('RECONFIRMATION_REQUIRED');
    render(<SessionNextActions events={[changed]} canManage={false} playerId={61} onSelect={select}/>);
    expect(screen.getByRole('heading', { name: 'Plans changed — confirm again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm or say you can’t come' }));expect(select).toHaveBeenCalledWith(changed);
});
it('does not count another child or cancelled event as an outstanding reply', () => {
    render(<SessionNextActions events={[{ ...event('UNANSWERED'), status: 'CANCELLED' }]} canManage={false} playerId={61} onSelect={vi.fn()}/>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('uses Georgian copy for the new next-action surface', async () => {
    await i18n.changeLanguage('ka');
    render(<SessionNextActions events={[event('UNANSWERED', true)]} canManage={false} playerId={61} onSelect={vi.fn()}/>);
    expect(screen.getByRole('heading', { name: 'მწვრთნელი დადასტურებას გთხოვთ' })).toBeInTheDocument();
});
it('does not ask for a reply when the coach did not ask for confirmation', () => {
    render(<SessionNextActions events={[event('UNANSWERED')]} canManage={false} playerId={61} onSelect={vi.fn()} compact/>);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
