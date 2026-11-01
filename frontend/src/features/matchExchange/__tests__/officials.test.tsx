import '../../../i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import type { Appointment, Match } from '../api';
import { Officials } from '../detail/Officials';
import { refereeState } from '../detail/matchState';

// Fix round 1: a competition match's referees are the competition's own appointments (nobody invites another), and a
// referee who is invited or appointed no longer reads "A referee is still needed".
afterEach(cleanup);

it('keeps a private referee’s appointment without exposing a name or profile link', () => {
    const m = match({ origin: 'COMPETITION', competition_name: 'Winter league', can_arrange_official: false,
        competition_referees: [{ id: 3, status: 'ACCEPTED' }] });
    show(m);
    expect(screen.getByText('Referee')).toBeInTheDocument();
    expect(screen.getByText('Appointed by Winter league')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(refereeState(m)).toEqual({ label: 'Appointed', tone: 'accent' });
});
const match = (patch: Partial<Match> = {}) => ({ event_id: 12, revision: 3, referee_required: true, referee_status: 'NEEDED', appointments: [], own_appointments: [],
    can_arrange_official: true, external_referee_name: null, ...patch } as unknown as Match);
const show = (m: Match) => render(<MemoryRouter><Officials match={m} active reload={() => undefined} /></MemoryRouter>);

it('shows a competition match’s referees as the competition appointed them, with no invitation to send', () => {
    show(match({ origin: 'COMPETITION', competition_name: 'Winter league', can_arrange_official: false,
        competition_referees: [{ id: 3, referee_id: 44, full_name: 'Levan Kapanadze', status: 'ACCEPTED' }] }));
    expect(screen.getByRole('link', { name: 'Levan Kapanadze' })).toHaveAttribute('href', '/profile/44');
    expect(screen.getByText('Appointed by Winter league')).toBeInTheDocument();
    expect(screen.queryByText('A referee is still needed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite/ })).not.toBeInTheDocument();
    cleanup();
    show(match({ origin: 'COMPETITION', can_arrange_official: false, competition_referees: [] }));
    expect(screen.getByText('The competition appoints the referee')).toBeInTheDocument();
    expect(screen.queryByText('Invite one directly or publish a request referees can answer.')).not.toBeInTheDocument();
});

it('says a referee is invited or appointed instead of still needed, to the referee as well', () => {
    show(match({ referee_status: 'INVITED', can_arrange_official: false }));
    expect(screen.getByText('A referee is invited')).toBeInTheDocument();
    expect(screen.queryByText('A referee is still needed')).not.toBeInTheDocument();
    cleanup();
    const mine = { id: 9, status: 'INVITED', duty: 'REFEREE', referee_id: 5 } as unknown as Appointment;
    show(match({ referee_status: 'INVITED', can_arrange_official: false, appointments: [mine], own_appointments: [mine] }));
    expect(screen.getByText('You are invited to referee this match')).toBeInTheDocument();
    expect(screen.queryByText('A referee is still needed')).not.toBeInTheDocument();
    cleanup();
    show(match({ referee_status: 'NEEDED', can_arrange_official: false }));
    expect(screen.getByText('A referee is still needed')).toBeInTheDocument();
});

it('match readiness reads a competition match’s referee from the competition, not “Not needed”', () => {
    const competition = (status?: 'ACCEPTED' | 'INVITED') => match({ origin: 'COMPETITION', referee_required: false, referee_status: 'NOT_REQUIRED',
        competition_referees: status ? [{ id: 3, referee_id: 44, full_name: 'Levan Kapanadze', status }] : [] });
    expect(refereeState(competition('ACCEPTED')).label).toBe('Appointed');
    expect(refereeState(competition('INVITED')).label).toBe('Invited');
    expect(refereeState(competition()).label).toBe('The competition appoints');
});
