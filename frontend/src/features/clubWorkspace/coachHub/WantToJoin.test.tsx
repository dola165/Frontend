import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { SquadJoinRequest } from '../../squadCommunication/api';
import type { CoachData } from './CoachWorkspace';
import type { WantToJoinItem } from './useSquadCards';
import { WantToJoin } from './WantToJoin';
import '../../../i18n';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: api.post } }));

const data = { shown: [103, 105], names: new Map([[103, 'U14 Boys'], [105, 'U16 Boys']]) } as unknown as CoachData;
const item = (over: Partial<WantToJoinItem>): WantToJoinItem => ({ key: `application-${over.id ?? 7}`, kind: 'APPLICATION', id: 7, squadId: 103, name: 'Natia Japaridze', age: 14,
    position: null, createdAt: '2026-10-29T06:00:00Z', source: 'WORLD', state: 'DECIDE', answeredBy: null, ...over });
const request = { id: 31, version: 2, source: 'ENQUIRY', playerId: 9, childName: 'Eka Lomidze', birthYear: 2014, guardianName: 'Nino Lomidze', message: null, createdAt: '2026-10-28T09:00:00Z',
    caseId: 31, destination: '/my-squads', groups: [{ id: 1301, version: 2, name: 'U12 intake', method: 'DIRECT' }], setup: { canConfigure: true, destination: null } } as SquadJoinRequest;
const items = [
    item({}),
    item({ key: 'request-31', kind: 'REQUEST', id: 31, squadId: 105, name: 'Eka Lomidze', source: 'ENQUIRY', request }),
    item({ key: 'application-8', id: 8, name: 'Shota Machavariani', state: 'ANSWERED', answeredBy: 'Koba Gelashvili' }),
];
const show = (onChanged = vi.fn()) => render(<MemoryRouter><WantToJoin items={items} data={data} onChanged={onChanged} /></MemoryRouter>);
const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('lists who wants to join from every door, each with its next step, and who answered first', () => {
    show();
    expect(screen.getByText('2 to decide')).toBeInTheDocument();
    // An application is a trial or not now; a request into the squad's joining group can also be accepted.
    expect(within(row('Natia Japaridze')).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(within(row('Natia Japaridze')).getByRole('button', { name: 'Invite to a trial' })).toBeInTheDocument();
    expect(within(row('Eka Lomidze')).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(row('Eka Lomidze')).getByText(/asked the club · U16 Boys/)).toBeInTheDocument();
    expect(within(row('Shota Machavariani')).getByText('Answered by Koba Gelashvili')).toBeInTheDocument();
    expect(within(row('Shota Machavariani')).queryByRole('button')).not.toBeInTheDocument();
});

it('says Not now to an application and accepts a request into its joining group', async () => {
    const changed = vi.fn();
    api.post.mockResolvedValue({ data: {} });
    show(changed);
    fireEvent.click(within(row('Natia Japaridze')).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/recruitment/applications/7/decline', {}));
    expect(await screen.findByText('Not now for Natia Japaridze.')).toBeInTheDocument();
    fireEvent.click(within(row('Eka Lomidze')).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/squad-communication/105/join-requests/31', expect.objectContaining({
        expectedVersion: 2, action: 'APPROVE', groupId: 1301, groupVersion: 2 })));
    expect(changed).toHaveBeenCalledTimes(2);
});

it('asks to set up joining first when a request has no joining group to go into', () => {
    const groupless = { ...request, groups: [], setup: { canConfigure: true, destination: '/admissions/manage' } };
    render(<MemoryRouter><WantToJoin items={[item({ key: 'request-32', kind: 'REQUEST', id: 32, name: 'Luka Beridze', source: 'LINK', request: groupless })]} data={data} onChanged={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Set up joining first' })).toHaveAttribute('href', '/admissions/manage');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
});

it('says the list couldn’t load, with Try again, rather than showing nothing', () => {
    const retry = vi.fn();
    render(<MemoryRouter><WantToJoin items={[]} failed onRetry={retry} data={data} onChanged={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Couldn’t load')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
});
