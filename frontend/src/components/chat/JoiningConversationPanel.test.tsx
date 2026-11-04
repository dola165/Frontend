import '../../i18n';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { ConnectedInquiry } from '../../features/joining-contract/types';
import { addMyParentLink } from '../../features/parents/familyLinks';
import { JoiningConversationPanel } from './JoiningConversationPanel';

const auth = vi.hoisted(() => ({ user: { id: 7, dob: '2012-05-10', fullName: 'Luka Beridze' } }));
const conversation = vi.hoisted(() => ({ fetchJoiningJourney: vi.fn(), commandJoiningJourney: vi.fn(), saveJoiningPreferences: vi.fn(), contactLabel: (c: { name: string }) => c.name }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: auth.user, sessionId: 'session' }) }));
vi.mock('../../utils/authStorage', async original => ({ ...(await original<object>()), isCurrentAuthSession: () => true }));
vi.mock('../../features/joining-contract/conversation', () => conversation);
vi.mock('../../features/parents/familyLinks', () => ({ remindParents: vi.fn(), addMyParentLink: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const terms = { feesKnown: true, charges: [], cancellation: 'A week ahead.', participation: 'Boots.', startDate: '2026-11-02', endDate: null, affiliationEffect: 'NONE', requirements: ['EMERGENCY_CONTACT'] };
const record = { id: 1, version: 1, playerId: 7, playerName: 'Luka Beridze', organizationName: 'Vake Walk FC', status: 'OPEN', history: [] } as unknown as ConnectedInquiry;
const journey = (staff = false) => ({
    inquiry: { ...record, applicantDestination: '/admissions/inquiries/1', staffDestination: '/clubs/70/office', history: [] },
    clubId: 70, squadName: '2012 Boys', programmeName: '2012 Boys', staff, canAct: staff, managed: false, handler: null, pendingHandler: null,
    privateHandoffNote: null, preferredFacilityId: null, context: { contacts: [], venues: [] }, group: null, sessions: [],
    programmeCharges: [], programmeFeesKnown: true, trialCost: '', preferences: null,
    arrangement: {
        id: 11, version: 3, playerId: 7, playerName: 'Luka Beridze', enrollment: null, requirements: [], actions: ['ACCEPT_OFFER'],
        sessions: [{ id: 5, version: 1, status: 'INVITED', title: 'First visit', startsAt: '2026-11-03T14:00:00Z', endsAt: '2026-11-03T15:00:00Z', location: { name: 'Vake Park', address: 'Tbilisi' }, contact: 'Levan', cost: 'Free', preparation: '' }],
        offer: { id: 9, version: 1, status: 'PENDING', groupName: '2012 Boys', terms, location: { name: 'Vake Park', address: 'Tbilisi' }, schedule: 'Tuesdays 18:00' },
    },
});
const open = async () => {
    render(<MemoryRouter><JoiningConversationPanel record={record} onChanged={() => undefined} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Details & next step' }));
    await screen.findByText(/Your place is ready to review/);
};

it('a teen with no parent here: staff can’t invite or offer from the chat, only pass it on', async () => {
    auth.user = { id: 40, dob: '1984-03-02', fullName: 'Nino Beridze' };
    conversation.fetchJoiningJourney.mockResolvedValue({ ...journey(true), parentFirst: true });
    render(<MemoryRouter><JoiningConversationPanel record={record} onChanged={() => undefined} /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Pass to a colleague' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite to training' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Offer a place' })).toBeNull();
});

it('a teen with no parent here sees that a place waits and how to add a parent, nothing the club wrote', async () => {
    auth.user = { id: 7, dob: `${new Date().getFullYear() - 14}-05-10`, fullName: 'Luka Beridze' };
    vi.mocked(addMyParentLink).mockResolvedValue({ id: 1, kind: 'ADD_PARENT', code: 'c'.repeat(43), path: `/family-link/${'c'.repeat(43)}`, expiresAt: '2026-11-16T00:00:00Z', personId: 7, personName: 'Luka' });
    const seen = journey();
    conversation.fetchJoiningJourney.mockResolvedValue({ ...seen, parentFirst: true, arrangement: { ...seen.arrangement, organizationName: 'Vake Walk FC', stage: 'PLACE_OFFERED', parentFirst: true, offer: null, sessions: [] } });
    render(<MemoryRouter><JoiningConversationPanel record={record} onChanged={() => undefined} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Details & next step' }));
    expect(await screen.findByDisplayValue(`${window.location.origin}/family-link/${'c'.repeat(43)}`)).toBeInTheDocument();
    expect(screen.queryByText(/Tuesdays 18:00/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remind my parent' })).toBeNull();
});

it('asks a teen’s parent for the yes instead of offering a form the club would refuse', async () => {
    auth.user = { id: 7, dob: `${new Date().getFullYear() - 14}-05-10`, fullName: 'Luka Beridze' };
    conversation.fetchJoiningJourney.mockResolvedValue(journey());
    await open();
    expect(screen.getByRole('button', { name: 'Remind my parent' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept this place' })).toBeNull();
    expect(screen.getByText('Under 18, a parent confirms this visit.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm training visit' })).toBeNull();
});

it('lets an adult player, and a parent, accept the place themselves', async () => {
    auth.user = { id: 7, dob: '2001-08-20', fullName: 'Giorgi Kapanadze' };
    conversation.fetchJoiningJourney.mockResolvedValue(journey());
    await open();
    expect(screen.getByRole('button', { name: 'Accept this place' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remind my parent' })).toBeNull();
    cleanup();
    auth.user = { id: 40, dob: '1984-03-02', fullName: 'Nino Beridze' };
    await open();
    expect(screen.getByRole('button', { name: 'Accept this place' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm training visit' })).toBeInTheDocument();
});
