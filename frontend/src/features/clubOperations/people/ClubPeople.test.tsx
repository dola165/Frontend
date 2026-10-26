import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refreshAccess } from '../../../hooks/useCan';
import { ClubPeople } from './ClubPeople';
import type { PeopleView, PersonJob, StaffLink } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const toast = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const job = (over: Partial<PersonJob>): PersonJob => ({ kind: 'APPOINTMENT', id: 1, job: 'HEAD_COACH', title: 'Head coach', clubWide: false, squads: [{ id: 5, name: 'U12' }], status: 'ACTIVE', unavailableReason: null, revision: 0, addedById: 1, addedByName: 'Nino', tools: [], ...over });
const view = (viewer: Partial<PeopleView['viewer']> = {}, extra: PeopleView['people'] = []): PeopleView => ({
    viewer: { userId: 1, leader: true, owner: true, headCoachSquads: [], ...viewer },
    people: [
        { userId: 1, name: 'Nino Owner', email: 'nino@example.test', avatarUrl: null, needsLink: false, jobs: [job({ kind: 'OWNER', id: 1, job: 'OWNER', title: 'Owner', clubWide: true, squads: [] })] },
        { userId: 2, name: 'Luka Beridze', email: 'luka@example.test', avatarUrl: null, needsLink: true, jobs: [job({ id: 9, job: 'ASSISTANT_COACH', title: 'Assistant coach', status: 'INVITED' })] },
        { userId: 3, name: 'Giga Kapanadze', email: null, avatarUrl: null, needsLink: false, jobs: [job({ id: 10, job: 'TEAM_MANAGER', title: 'Team manager', source: 'STAFF_LINK', staffLinkId: 70,
            changedByName: 'Nino', changedAt: '2026-10-25T10:00:00', history: [{ at: '2026-10-25T10:00:00', byName: 'Nino', action: 'CHANGED', summary: 'Assistant coach → Team manager · U12' }] })] },
        { userId: 4, name: 'Mari Admin', email: null, avatarUrl: null, needsLink: false, jobs: [job({ kind: 'ADMIN', id: 4, job: 'ADMIN', title: 'Admin', clubWide: true, squads: [] })] },
        ...extra,
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
const staffLink = (over: Partial<StaffLink> = {}): StaffLink => ({ id: 70, job: 'HEAD_COACH', title: 'Head coach', clubWide: true, squads: [], status: 'ACTIVE', code: 'staffcode', path: '/staff-invite/staffcode',
    uses: 3, maxUses: 10, expiresAt: '2026-11-02T12:00:00', createdAt: '2026-10-26T09:00:00', createdById: 1, createdByName: 'Nino',
    joined: [{ appointmentId: 120, userId: 12, name: 'Tamar Lomidze', avatarUrl: null, joinedAt: '2026-10-26T10:00:00', status: 'ACTIVE', revision: 2 }], ...over });
const suggested = { userId: 30, name: 'Dato Kvaratskhelia', email: 'dato@example.test', avatarUrl: null, needsLink: true,
    jobs: [job({ id: 55, job: 'ASSISTANT_COACH', title: 'Assistant coach', status: 'SUGGESTED', revision: 3, suggestedById: 4, suggestedByName: 'Giorgi', canConfirm: true })] };

/** The People view, the staff links and the rule-checker (an old server without it unless `access` is given). */
const renderPeople = (data: PeopleView, { links = [] as StaffLink[], access = null as unknown, url = '/' } = {}) => {
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) { if (access) return { data: access }; throw new Error('no rule-checker'); }
        if (path.endsWith('/staff-links')) return { data: links };
        return { data };
    });
    return render(<MemoryRouter initialEntries={[url]}><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
};

beforeEach(() => { vi.clearAllMocks(); refreshAccess(); api.post.mockResolvedValue({ data: {} }); api.put.mockResolvedValue({ data: {} }); api.delete.mockResolvedValue({ data: {} }); });
afterEach(cleanup);

it('lists each person with their jobs and where, and invited people with a new link', async () => {
    renderPeople(view());
    const luka = (await screen.findByText('Luka Beridze')).closest('li') as HTMLElement;
    expect(within(luka).getByText('Assistant coach')).toBeInTheDocument();
    expect(within(luka).getByText('U12')).toBeInTheDocument();
    expect(within(luka).getByText('Invited')).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: { token: 'abc.def', expiresAt: '2026-10-30T12:00:00' } });
    fireEvent.click(within(luka).getByRole('button', { name: /New link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/2/link'));
    const whatsapp = await within(luka).findByRole('link', { name: /WhatsApp/ });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=.*club-invite%3Ftoken%3Dabc.def/);
});

it('an admin invites one person, Admin included, and gets the link to send', async () => {
    renderPeople(view());
    fireEvent.click(await screen.findByRole('button', { name: /Invite one person/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Tamar Lomidze' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'tamar@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assistant coach' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'U14' }));
    api.post.mockResolvedValueOnce({ data: { userId: 8, name: 'Tamar Lomidze', inApp: false, status: 'INVITED', link: { token: 'tok', expiresAt: '2026-10-30T12:00:00' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/invites', {
        name: 'Tamar Lomidze', email: 'tamar@example.test', job: 'ASSISTANT_COACH', title: null, tools: null, clubWide: false, squadIds: [6],
    }));
    expect(await screen.findByLabelText('Invite link for Tamar Lomidze')).toHaveValue(`${window.location.origin}/club-invite?token=tok`);
});

it('invites staff in bulk with one link and QR code, never as Admin, and removes someone who joined', async () => {
    renderPeople(view(), { links: [staffLink(), staffLink({ id: 60, status: 'EXPIRED', code: null, path: null })], url: '/?invite=link' });
    await screen.findByLabelText('Staff link');
    const dialog = screen.getByRole('dialog', { name: 'Invite staff' });
    for (const job of ['Head coach', 'Assistant coach', 'Team manager', 'Fees']) expect(within(dialog).getByRole('button', { name: job })).toBeInTheDocument();
    for (const other of ['Admin', 'Owner', 'More jobs', 'Custom']) expect(within(dialog).queryByRole('button', { name: other })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/staffcode`);
    expect(within(dialog).getByTitle(/QR code/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 of 10 uses left/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Tamar Lomidze' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/jobs/120/end', { revision: 2 }));
    expect(await within(dialog).findByText(/Nobody yet/)).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: staffLink({ id: 71, code: 'newcode', path: '/staff-invite/newcode', uses: 0, joined: [] }) });
    fireEvent.click(within(dialog).getByRole('button', { name: /New link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/staff-links', { requestId: expect.any(String), job: 'HEAD_COACH', title: null, tools: null, clubWide: true, squadIds: [] }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/7/staff-links/70'));
    expect(await within(dialog).findByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/newcode`);
});

it('an admin changes a job at once, sees where it came from, and can end an Admin but never the Owner', async () => {
    renderPeople(view());
    expect(await screen.findByText('Accepted by Giga, not Luka.')).toBeInTheDocument();
    const giga = screen.getByText('Giga Kapanadze').closest('li') as HTMLElement;
    expect(within(giga).getByText(/Changed by Nino/)).toBeInTheDocument();
    fireEvent.click(within(giga).getByRole('button', { name: /History/ }));
    expect(within(giga).getByText('Changed · Team manager: Assistant coach → Team manager · U12')).toBeInTheDocument();

    fireEvent.click(within(giga).getByRole('button', { name: /Change/ }));
    const form = within(giga).getByRole('form');
    expect(within(form).queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Head coach' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/clubs/7/people/jobs/10', {
        job: 'HEAD_COACH', title: null, tools: null, clubWide: false, squadIds: [5], revision: 0,
    }));
    expect(await screen.findByText('Giga Kapanadze: Head coach · U12. Changed now.')).toBeInTheDocument();

    const owner = screen.getByText('Nino Owner').closest('li') as HTMLElement;
    expect(within(owner).queryByRole('button', { name: /Remove|End job/ })).not.toBeInTheDocument();
    const mari = screen.getByText('Mari Admin').closest('li') as HTMLElement;
    fireEvent.click(within(mari).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End job' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/admins/4/end'));
});

it('a head coach suggests an assistant for their own squad and changes nobody’s job', async () => {
    renderPeople(view({ userId: 4, leader: false, owner: false, headCoachSquads: [5] }));
    expect(await screen.findByText('Luka Beridze')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite staff|Invite one person/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Change/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Suggest an assistant/ }));
    const dialog = screen.getByRole('dialog', { name: 'Suggest an assistant' });
    expect(within(dialog).getByText(/A helper for U12/)).toBeInTheDocument();
    for (const other of ['Head coach', 'Fees', 'Admin']) expect(within(dialog).queryByRole('button', { name: other })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Team manager' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Dato Kvaratskhelia' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'dato@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suggest' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/invites', {
        name: 'Dato Kvaratskhelia', email: 'dato@example.test', job: 'TEAM_MANAGER', title: null, tools: null, clubWide: false, squadIds: [5],
    }));
    expect(await screen.findByText(/An admin confirms or declines it/)).toBeInTheDocument();
});

it('an admin confirms a suggested assistant and gets the link to send', async () => {
    renderPeople(view({}, [suggested]));
    const waiting = await screen.findByRole('list', { name: 'Suggested assistants' });
    expect(within(waiting).getByText(/Suggested by Giorgi/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'People' }) && within(screen.getByRole('list', { name: 'People' })).queryByText('Dato Kvaratskhelia')).toBeNull();
    api.post.mockResolvedValueOnce({ data: { appointmentId: 55, outcome: 'CONFIRMED', answeredBy: 'Nino Owner', link: { token: 'dato.tok', expiresAt: '2026-11-02T12:00:00' } } });
    fireEvent.click(within(waiting).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/suggestions/55', { confirm: true, revision: 3 }));
    expect(await screen.findByLabelText('Invite link for Dato Kvaratskhelia')).toBeInTheDocument();
});

it('follows the rule-checker: a refused button is hidden and its plain reason shows', async () => {
    renderPeople(view({ userId: 4, leader: false, owner: false, headCoachSquads: [] }), {
        access: { clubId: 7, squadId: null, allowed: ['see_people', 'follow'], admins: [{ userId: 1, name: 'Nino Owner' }], refused: [
            { action: 'invite_staff', allowed: false, reason: 'ONLY_ADMINS', message: 'Only the club’s admins can do this.', because: null },
            { action: 'suggest_assistant', allowed: false, reason: 'ONLY_HEAD_COACHES', message: 'Only head coaches can do this.', because: null }] },
    });
    expect(await screen.findByText('Only the club’s admins can do this.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ask the admin/ })).toHaveAttribute('href', '/messages?chatWith=1');
    expect(screen.queryByRole('button', { name: /Invite staff|Suggest an assistant/ })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/access/clubs/7', expect.anything());
});

it('asks to confirm the email first when the server refuses an invite for it', async () => {
    renderPeople(view(), { url: '/?invite=person' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Tamar Lomidze' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'tamar@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'U12' }));
    api.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: { code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'INVITE', message: 'Confirm your email first.' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Confirm your email first', expect.objectContaining({ action: expect.objectContaining({ label: 'Resend' }) })));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});

it('opens Invite staff even when the links fail to load, with Try again', async () => {
    let fail = true;
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) throw new Error('no rule-checker');
        if (path.endsWith('/staff-links')) { if (fail) throw new Error('down'); return { data: [staffLink()] }; }
        return { data: view() };
    });
    render(<MemoryRouter initialEntries={['/?invite=link']}><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
    const dialog = await screen.findByRole('dialog', { name: 'Invite staff' });
    expect(within(dialog).queryByRole('button', { name: /Make the link/ })).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/staffcode`);
});

it('New link shows the new link even if switching off the old one fails, and offers Switch off for it', async () => {
    renderPeople(view(), { links: [staffLink()], url: '/?invite=link' });
    await screen.findByLabelText('Staff link');
    const dialog = screen.getByRole('dialog', { name: 'Invite staff' });
    api.post.mockResolvedValueOnce({ data: staffLink({ id: 71, code: 'newcode', path: '/staff-invite/newcode', uses: 0, joined: [] }) });
    api.delete.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(within(dialog).getByRole('button', { name: /New link/ }));
    expect(await within(dialog).findByText('The old link is still on.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/newcode`);
    api.delete.mockResolvedValueOnce({ data: {} });
    fireEvent.click(within(within(dialog).getByText('The old link is still on.').closest('div') as HTMLElement).getByRole('button', { name: /Switch off/ }));
    await waitFor(() => expect(api.delete).toHaveBeenLastCalledWith('/clubs/7/staff-links/70'));
    await waitFor(() => expect(within(dialog).queryByText('The old link is still on.')).not.toBeInTheDocument());
    expect(api.post.mock.calls.filter(([url]) => url === '/clubs/7/staff-links')).toHaveLength(1);
});

it('keeps the buttons disabled while the rule-checker answers, so none appears and vanishes', async () => {
    let answer!: (value: unknown) => void;
    api.get.mockImplementation((path: string) => path.startsWith('/access/') ? new Promise(resolve => { answer = resolve; })
        : Promise.resolve({ data: path.endsWith('/staff-links') ? [] : view() }));
    render(<MemoryRouter><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: /Invite staff/ })).toBeDisabled();
    answer({ data: { clubId: 7, squadId: null, allowed: ['invite_staff', 'make_admin', 'change_job', 'end_job'], refused: [] } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Invite staff/ })).toBeEnabled());
});
