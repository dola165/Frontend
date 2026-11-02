import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClubApplication, selfRegisterClubPlayer } from '../../api';
import type { PublicSquad } from '../../publicJourney';
import type { ClubProfile } from '../types';
import { ChildPart, HelpPart, PlayPart } from './JoinParts';
import type { JoinFacts } from './useJoinFacts';

vi.mock('../../api', () => ({ createClubApplication: vi.fn(), selfRegisterClubPlayer: vi.fn() }));
vi.mock('../../../applications/clubEntry', () => ({
    useClubEntryEligibility: () => ({ data: { allowed: true }, allowed: true, error: false, loading: false, sessionId: 'join', reload: vi.fn() }),
    useEntryCopy: () => ({ copy: (en: string) => en, reason: () => 'Not now.' }),
}));
vi.mock('../../../actions/ActionButton', () => ({ ActionButton: ({ action }: { action: string }) => <a href={`?do=${action}`}>Add my child</a> }));

const squad = (id: number, name: string, category: string, gender = 'MALE'): PublicSquad => ({ id, name, category, gender });
const squads = [squad(1, 'U12 Mixed', 'U12', 'MIXED'), squad(2, 'U14 Boys', 'U14'), squad(3, 'First Team', 'SENIOR')];
const club = (policy: ClubProfile['playerJoinPolicy'] = 'APPLICATION_REQUIRED') => ({ id: 4, name: 'Saburtalo', playerJoinPolicy: policy }) as ClubProfile;
const facts = (overrides: Partial<JoinFacts> = {}): JoinFacts => ({
    signedIn: true, age: 40, minor: false, choice: null, loading: false, squads, mySquads: [squads[2]], coaches: [], jobs: [], uncoached: [], children: [],
    ...overrides,
});
const show = (node: React.ReactNode) => render(<MemoryRouter initialEntries={['/clubs/4?join=play']}>{node}</MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('Play', () => {
    it('lists only the squads for the person, then asks to join the chosen one with a position', async () => {
        vi.mocked(createClubApplication).mockResolvedValue({ applicationId: 9 });
        const changed = vi.fn();
        show(<PlayPart club={club()} facts={facts()} onContact={vi.fn()} onChanged={changed} />);
        expect(screen.getByText('First Team')).toBeInTheDocument();
        expect(screen.queryByText('U12 Mixed')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Midfielder' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
        await waitFor(() => expect(createClubApplication).toHaveBeenCalledWith(4, 'PLAYER', null, { position: 'MIDFIELDER', ageGroup: 'SENIOR', squadId: 3 }, { _authSessionId: 'join' }));
        expect(await screen.findByText('Request sent to Saburtalo.')).toBeInTheDocument();
        expect(changed).toHaveBeenCalled();
    });

    it('comes to a trial with the club, showing the squads without a choice', async () => {
        vi.mocked(selfRegisterClubPlayer).mockResolvedValue({} as never);
        show(<PlayPart club={club('OPEN_TRIAL')} facts={facts()} onContact={vi.fn()} onChanged={vi.fn()} />);
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Come to a trial' }));
        expect(await screen.findByText('You can come to training as a trialist.')).toBeInTheDocument();
    });

    it('says when no squad suits the person, asks for a birth date when it is missing, and shows a guest the squads', () => {
        const first = show(<PlayPart club={club()} facts={facts({ mySquads: [] })} onContact={vi.fn()} onChanged={vi.fn()} />);
        expect(screen.getByText('No squad for your age here.')).toBeInTheDocument();
        first.unmount();
        const second = show(<PlayPart club={club()} facts={facts({ age: null, mySquads: squads })} onContact={vi.fn()} onChanged={vi.fn()} />);
        expect(screen.getByRole('link', { name: 'Add your date of birth' })).toHaveAttribute('href', '/onboarding');
        expect(screen.queryByText('U12 Mixed')).not.toBeInTheDocument();
        second.unmount();
        show(<PlayPart club={club()} facts={facts({ signedIn: false, age: null })} onContact={vi.fn()} onChanged={vi.fn()} />);
        expect(screen.getByText('U12 Mixed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in to join' })).toHaveAttribute('href', expect.stringContaining('/login'));
    });
});

describe('My child', () => {
    const nika = { id: 254, name: 'Nika Testadze', dateOfBirth: `${new Date().getFullYear() - 11}-01-10`, minor: true, guardian: true, provenance: null, gender: 'MALE' as const };

    it('lists the squads for the child and asks the club about a place, with the child and the squad', () => {
        const contact = vi.fn();
        show(<ChildPart club={club()} facts={facts({ children: [nika] })} onContact={contact} />);
        expect(screen.getByText('U12 Mixed')).toBeInTheDocument();
        expect(screen.getByText('U14 Boys')).toBeInTheDocument();
        expect(screen.queryByText('First Team')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: /U14 Boys/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Ask about a place for Nika' }));
        expect(contact).toHaveBeenCalledWith({ name: 'U14 Boys', path: '/clubs/4?tab=teams&squad=2', squadIds: [2], intent: 'question' }, 254);
    });

    it('asks a parent with no child yet to add one', () => {
        show(<ChildPart club={club()} facts={facts()} onContact={vi.fn()} />);
        expect(screen.getByRole('link', { name: 'Add my child' })).toHaveAttribute('href', '?do=add_child');
    });
});

describe('Help out', () => {
    it('lists the open jobs, each to its page, and the squads with no coach on the club page', () => {
        const contact = vi.fn();
        show(<HelpPart club={club()} facts={facts({ jobs: [{ id: 31, title: 'Assistant coach U14 · Sample', ageGroup: 'U14', level: 'LICENSED' }], uncoached: [squads[1]] })} onContact={contact} />);
        expect(screen.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/jobs/31');
        expect(screen.getByText('U14 · Licensed')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Ask the club' }));
        expect(contact).toHaveBeenCalledWith(expect.objectContaining({ name: 'U14 Boys', squadIds: [2] }));
        expect(createClubApplication).not.toHaveBeenCalled();
    });

    it('offers to ask the club when it has no open jobs', () => {
        show(<HelpPart club={club()} facts={facts()} onContact={vi.fn()} />);
        expect(screen.getByText('No open jobs here right now.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ask the club' })).toBeInTheDocument();
    });
});
