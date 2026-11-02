import '../../../i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { SquadOverview } from '../api';
import { SquadPage } from './SquadPage';

const data = vi.hoisted(() => ({ space: null as unknown, children: [] as unknown[], overview: null as null | (() => Promise<unknown>) }));
vi.mock('../api', async original => ({ ...(await original<object>()), overview: () => (data.overview ? data.overview() : Promise.resolve(data.space)) }));
vi.mock('./useViewerChildren', () => ({ useViewerFamily: () => ({ children: data.children, known: true, error: null, retry: () => undefined }) }));
vi.mock('../useClubCrest', () => ({ useClubCrest: () => null }));
vi.mock('../../actions/SquadDoors', () => ({ SquadDoors: () => null }));
vi.mock('../SquadMessages', () => ({ SquadMessages: () => <div>Coach updates</div> }));
vi.mock('../../parents/hub/NextUp', () => ({ NextUp: ({ playerId, childName }: { playerId: number; childName: string }) => <p>Next up for {childName} #{playerId}</p> }));
afterEach(() => { cleanup(); data.children = []; data.overview = null; });

const squad = (more: Partial<SquadOverview> = {}): SquadOverview => ({
    id: 24, club_id: 70, academy_name: 'Vake Walk FC', name: '2012 Boys', category: 'U14', can_manage: false, unread_count: 0,
    viewer_id: 7, member_count: 2, notify_chat: false, head_coach_id: 3, can_assign_coach: false, available_coaches: [],
    coaches: [{ user_id: 3, full_name: 'Levan Coach' }], players: [{ id: 7, name: 'Luka Beridze' }], threads: [], ...more,
});
const open = () => render(<MemoryRouter><SquadPage id={24} /></MemoryRouter>);

it('is a player’s own squad page: back to their football, and their next session beside the updates', async () => {
    data.space = squad();
    open();
    expect(await screen.findByText('Next up for Luka #7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your football' })).toHaveAttribute('href', '/account/football');
    expect(screen.queryByRole('link', { name: 'Parent Hub' })).toBeNull();
});

it('still sends a coach back to My squads and someone with no place on the squad to Parent Hub', async () => {
    data.space = squad({ can_manage: true });
    open();
    expect(await screen.findByRole('link', { name: 'My squads' })).toHaveAttribute('href', '/my-squads');
    expect(screen.queryByText(/Next up for/)).toBeNull();
    cleanup();
    data.space = squad({ players: [{ id: 8, name: 'Someone Else' }] });
    open();
    expect(await screen.findByRole('link', { name: 'Parent Hub' })).toHaveAttribute('href', '/parent');
    expect(screen.queryByText(/Next up for/)).toBeNull();
});

it('shows no back link while the squad loads or when it fails, rather than guessing Parent Hub', async () => {
    data.overview = () => new Promise(() => undefined);
    open();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.queryByRole('link', { name: 'Parent Hub' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your football' })).toBeNull();
    cleanup();
    data.overview = () => Promise.reject(new Error('offline'));
    open();
    expect(await screen.findByText('Squad page unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Parent Hub' })).toBeNull();
});
