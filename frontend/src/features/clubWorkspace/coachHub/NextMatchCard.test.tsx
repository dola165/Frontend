import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { Match } from '../../matchExchange/api';
import type { CoachData } from './CoachWorkspace';
import { NextMatchCard } from './NextMatchCard';
import type { MatchCard } from './squadApi';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: api.post } }));

const data = { clubId: 1, clubName: 'FC Dinamo Tbilisi Academy', clubLogo: null, now: Date.parse('2026-10-29T10:00:00+04:00'),
    link: (tab: string, context: Record<string, string> = {}) => `/my-squads?${new URLSearchParams({ tab, ...context })}` } as unknown as CoachData;
const match = { event_id: 5730, squad_id: 105, club_id: 1, club_name: 'FC Dinamo Tbilisi Academy', opponent_name: 'Kutaisi City Academy', venue_preference: 'AWAY',
    title: 'U16 Boys v Kutaisi City Academy', starts_at_iso: '2026-11-07T11:00:00+04:00', ends_at_iso: '2026-11-07T12:45:00+04:00', location_name: 'Ramaz Shengelia Stadium',
    referee_required: true, referee_status: 'ACCEPTED', venue_status: 'BOOKED' } as unknown as Match;
const callUps = [{ id: 1, name: 'Giorgi Mikadze', selected: true, response: 'GOING', revision: 1, canRespond: false },
    { id: 2, name: 'Saba Kiteishvili', selected: true, response: 'UNANSWERED', revision: 1, canRespond: false }];
const card = (can: MatchCard['can']): MatchCard => ({ squadId: 105, squadName: 'U16 Boys', match, callUps, fitness: { fit: 11, doubtful: 1, out: 0, players: [] }, preparation: null, trip: null, can });
const nothing = { callUps: false, remind: false, checklist: false, bus: false };
const show = (value: MatchCard, compact = false) => render(<MemoryRouter><NextMatchCard card={value} data={data} compact={compact} onChanged={vi.fn()} /></MemoryRouter>);

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('gives a team manager call-ups, Remind, the checklist and the bus on the card everyone on the squad sees', () => {
    show(card({ callUps: true, remind: true, checklist: true, bus: true }));
    expect(screen.getByRole('link', { name: 'Call-ups' })).toHaveAttribute('href', '/match-exchange/5730');
    expect(screen.getByRole('button', { name: 'Remind' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book the bus' })).toBeInTheDocument();
    expect(screen.getAllByText('1 coming · 1 hasn’t answered').length).toBeGreaterThan(0);
    // Fitness leaves its drawer only as Fit, Doubtful or Out.
    expect(screen.getByText('11 fit')).toBeInTheDocument();
    expect(screen.getByText('1 doubtful')).toBeInTheDocument();
});

it('shows a goalkeeper coach the same card, with only Open the match', () => {
    show(card(nothing));
    expect(screen.getByRole('link', { name: 'Open the match' })).toHaveAttribute('href', '/match-exchange/5730');
    for (const name of ['Remind', 'Checklist']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Book the bus' })).not.toBeInTheDocument();
    expect(screen.getByText('11 fit')).toBeInTheDocument();
});

it('reminds the families who haven’t answered and says how many', async () => {
    api.post.mockResolvedValueOnce({ data: { reminded: 1 } });
    show(card({ ...nothing, callUps: true, remind: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Remind' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/match-arrangements/5730/squads/105/remind'));
    expect(await screen.findByText('Reminded 1 family.')).toBeInTheDocument();
});

it('puts the match on a squad’s card as one line to Matches, with no buttons', () => {
    show(card({ callUps: true, remind: true, checklist: true, bus: true }), true);
    const line = screen.getByRole('link');
    expect(line).toHaveAttribute('href', '/my-squads?tab=matches&squad=105');
    expect(line).toHaveTextContent('v Kutaisi City Academy');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
