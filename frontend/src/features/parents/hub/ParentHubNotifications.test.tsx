import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JoiningChild } from '../../joining-contract/types';

/** Layer 1 walk, parent p7: once a child plays somewhere, Parent Hub is where a parent turns on the coach's pings. */
const family = vi.hoisted(() => ({ children: [] as unknown[] }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 }, sessionId: 'session', status: 'authenticated' }) }));
vi.mock('../../squadCommunication/journeyCopy', () => ({ useJourneyCopy: () => ((en: string) => en) }));
vi.mock('../../../utils/authStorage', async original => ({ ...(await original<object>()), isCurrentAuthSession: () => true }));
vi.mock('../api', () => ({ fetchJoiningChildren: vi.fn(async () => ({ children: family.children })) }));
vi.mock('../../../components/notifications/TurnOnNotificationsPrompt', () => ({ TurnOnNotificationsPrompt: ({ reason }: { reason?: string }) => <p>Turn on: {reason}</p> }));
vi.mock('./ChildPage', () => ({ ChildPage: () => <p>Child page</p> }));
vi.mock('./OneCard', () => ({ OneCard: () => null }));
vi.mock('../../clubOperations/registration/PersonalRegistrationHistory', () => ({ PersonalRegistrationHistory: () => null }));
vi.mock('../../world/finder/ClubFinderHost', () => ({ ClubFinderHost: () => null }));
vi.mock('../AddChild', () => ({ AddChild: () => null }));

import { ParentHub } from './ParentHub';

const child = (clubs: unknown[]): JoiningChild => ({ playerId: 61, identity: { playerId: 61, version: 1, fullName: 'Luka Beridze', dateOfBirth: '2016-05-20', gender: null,
    photoUrl: null, positions: [], dominantFoot: null, heightCm: null, weightKg: null, canEdit: true, minor: true }, clubs, cases: [], inquiries: [] } as unknown as JoiningChild);
const mount = () => render(<MemoryRouter initialEntries={['/parent']}><ParentHub sessionId={'session' as never} /></MemoryRouter>);

afterEach(cleanup);

describe('Parent Hub and the coach’s pings', () => {
    it('offers the one press that turns on everything a parent needs, sessions and matches too, once a child has a club', async () => {
        family.children = [child([{ id: 1, name: 'Dinamo Academy', squads: [] }])];
        mount();
        expect(await screen.findByText(/Turn on: .*a session moves, a match changes/)).toBeInTheDocument();
    });

    it('offers no phone calendar link to someone without children (W8)', async () => {
        family.children = [];
        mount();
        await waitFor(() => expect(screen.getByText('Add your child')).toBeInTheDocument());
        expect(screen.queryByText(/phone’s calendar/)).not.toBeInTheDocument();
    });

    it('asks nothing while no child has a club yet', async () => {
        family.children = [child([])];
        mount();
        await waitFor(() => expect(screen.getByText('Child page')).toBeInTheDocument());
        expect(screen.queryByText(/Turn on/)).not.toBeInTheDocument();
    });
});
