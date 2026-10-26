import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ClubPeople } from './ClubPeople';
import type { PeopleView, PersonJob } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
vi.mock('../../clubWorkspace/coachHub/ResponsibilityRequests', () => ({ ResponsibilityRequests: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Ask the admin form" /> : null }));

const job = (over: Partial<PersonJob>): PersonJob => ({ kind: 'APPOINTMENT', id: 1, job: 'HEAD_COACH', title: 'Head coach', clubWide: false, squads: [{ id: 5, name: 'U12' }], status: 'ACTIVE', unavailableReason: null, revision: 0, addedById: 1, addedByName: 'Nino', addedByHeadCoach: false, tools: [], ...over });
const view = (viewer: Partial<PeopleView['viewer']> = {}): PeopleView => ({
    viewer: { userId: 1, leader: true, owner: true, headCoachSquads: [], ...viewer },
    people: [
        { userId: 1, name: 'Nino Owner', email: 'nino@example.test', avatarUrl: null, needsLink: false, jobs: [job({ kind: 'OWNER', id: 1, job: 'OWNER', title: 'Owner', clubWide: true, squads: [] })] },
        { userId: 2, name: 'Luka Beridze', email: 'luka@example.test', avatarUrl: null, needsLink: true, jobs: [job({ id: 9, job: 'ASSISTANT_COACH', title: 'Assistant coach', status: 'INVITED' })] },
        { userId: 3, name: 'Giga Kapanadze', email: null, avatarUrl: null, needsLink: false, jobs: [job({ id: 10, job: 'TEAM_MANAGER', title: 'Team manager', addedById: 4, addedByName: 'Dato', addedByHeadCoach: true })] },
    ],
    nameChecks: [{ id: 33, userId: 3, invitedName: 'Luka', acceptedName: 'Giga', at: '2026-10-23T10:00:00' }],
    squads: [{ id: 5, name: 'U12' }, { id: 6, name: 'U14' }],
    jobs: [
        { key: 'HEAD_COACH', title: 'Head coach', description: 'Squad attendance, development and match preparation.', tools: [] },
        { key: 'ASSISTANT_COACH', title: 'Assistant coach', description: 'Help run training.', tools: [] },
        { key: 'TEAM_MANAGER', title: 'Team manager', description: 'Match arrangements.', tools: [] },
        { key: 'FEES', title: 'Fees', description: 'Membership fees.', tools: ['FINANCE:WRITE'] },
        { key: 'ADMIN', title: 'Admin', description: 'Every tool.', tools: [] },
    ],
    moreJobs: [{ key: 'GOALKEEPER_COACH', title: 'Goalkeeper coach', description: 'Goalkeepers.', tools: [] }],
    tools: ['ATTENDANCE:READ', 'ATTENDANCE:WRITE'],
});

const renderPeople = (data: PeopleView, roles = false) => {
    api.get.mockResolvedValue({ data });
    return render(<MemoryRouter><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" roles={roles ? ({ leadership: false } as never) : null} /></MemoryRouter>);
};

beforeEach(() => { vi.clearAllMocks(); api.post.mockResolvedValue({ data: {} }); api.put.mockResolvedValue({ data: {} }); });
afterEach(cleanup);

it('lists each person with their jobs and where, and invited people with a new link', async () => {
    renderPeople(view());
    const luka = (await screen.findByText('Luka Beridze')).closest('li') as HTMLElement;
    expect(within(luka).getByText('Assistant coach')).toBeInTheDocument();
    expect(within(luka).getByText('U12')).toBeInTheDocument();
    expect(within(luka).getByText('Invited')).toBeInTheDocument();
    expect(within(luka).getByText('luka@example.test')).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: { token: 'abc.def', expiresAt: '2026-10-30T12:00:00' } });
    fireEvent.click(within(luka).getByRole('button', { name: /New link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/2/link'));
    const whatsapp = await within(luka).findByRole('link', { name: /WhatsApp/ });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=.*club-invite%3Ftoken%3Dabc.def/);
    expect(within(luka).getByRole('button', { name: /Copy/ })).toBeInTheDocument();
});

it('an admin invites with name, email, job and where, and gets the link to send', async () => {
    renderPeople(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Tamar Lomidze' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'tamar@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assistant coach' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'U14' }));
    api.post.mockResolvedValueOnce({ data: { userId: 8, name: 'Tamar Lomidze', inApp: false, link: { token: 'tok', expiresAt: '2026-10-30T12:00:00' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/invites', {
        name: 'Tamar Lomidze', email: 'tamar@example.test', job: 'ASSISTANT_COACH', title: null, tools: null, clubWide: false, squadIds: [6],
    }));
    expect(await screen.findByLabelText('Invite link for Tamar Lomidze')).toHaveValue(`${window.location.origin}/club-invite?token=tok`);
    expect(screen.getByText(/Invited Tamar Lomidze/)).toBeInTheDocument();
});

it('an admin changes a job in place and sees invites accepted under another name and head-coach helpers', async () => {
    renderPeople(view());
    expect(await screen.findByText('Accepted by Giga, not Luka.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/name-checks/33/keep'));

    const giga = screen.getByText('Giga Kapanadze').closest('li') as HTMLElement;
    expect(within(giga).getByText('Added by Dato')).toBeInTheDocument();
    expect(within(giga).getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    fireEvent.click(within(giga).getByRole('button', { name: /Change/ }));
    const form = within(giga).getByRole('form');
    fireEvent.click(within(form).getByRole('button', { name: 'Head coach' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/clubs/7/people/jobs/10', {
        job: 'HEAD_COACH', title: null, tools: null, clubWide: false, squadIds: [5], revision: 0,
    }));
});

it('a head coach invites only helpers to the squads they coach, and asks the admin for the rest', async () => {
    renderPeople(view({ userId: 4, leader: false, owner: false, headCoachSquads: [5] }), true);
    fireEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Assistant coach' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Team manager' })).toBeInTheDocument();
    for (const other of ['Head coach', 'Fees', 'Admin', 'More jobs', 'Custom', 'Whole club', 'U14'])
        expect(within(dialog).queryByRole('button', { name: other })).not.toBeInTheDocument();
    expect(within(dialog).getByText('For any other job, ask an admin.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: /Change/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ask the admin/ }));
    expect(screen.getByRole('dialog', { name: 'Ask the admin form' })).toBeInTheDocument();
});
