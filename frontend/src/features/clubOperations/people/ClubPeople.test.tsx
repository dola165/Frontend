import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refreshAccess } from '../../../hooks/useCan';
import { ClubPeople } from './ClubPeople';
import type { PeopleView, PersonJob, StaffLink } from './api';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const toast = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
const auth = vi.hoisted(() => ({ user: { id: 1, dob: '1985-01-01' }, refreshNavigationCapabilities: () => Promise.resolve() }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));

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

/** Staff, the staff links and the rule-checker (an old server without it unless `access` is given). */
const renderPeople = (data: PeopleView, { links = [] as StaffLink[], access = null as unknown, url = '/', tools = {} } = {}) => {
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) { if (access) return { data: access }; throw new Error('no rule-checker'); }
        if (path.endsWith('/staff-links')) return { data: links };
        return { data };
    });
    return render(<MemoryRouter initialEntries={[url]}><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" tools={tools} /></MemoryRouter>);
};
const row = (name: string) => screen.getByText(name).closest('li.pp-person') as HTMLElement;

beforeEach(() => { vi.clearAllMocks(); refreshAccess(); auth.user = { id: 1, dob: '1985-01-01' }; api.post.mockResolvedValue({ data: {} }); api.put.mockResolvedValue({ data: {} }); api.delete.mockResolvedValue({ data: {} }); });
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

it('an admin invites one person to any job, Admin included, and gets the link to send', async () => {
    renderPeople(view());
    fireEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog', { name: 'Invite to a job' });
    expect(within(dialog).getByRole('button', { name: 'Admin' })).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Send to one person/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assistant coach' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'U14' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Tamar Lomidze' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'tamar@example.test' } });
    api.post.mockResolvedValueOnce({ data: { userId: 8, name: 'Tamar Lomidze', inApp: false, status: 'INVITED', link: { token: 'tok', expiresAt: '2026-10-30T12:00:00' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/invites', {
        name: 'Tamar Lomidze', email: 'tamar@example.test', job: 'ASSISTANT_COACH', title: null, tools: null, clubWide: false, squadIds: [6],
    }));
    expect(await screen.findByLabelText('Invite link for Tamar Lomidze')).toHaveValue(`${window.location.origin}/club-invite?token=tok`);
});

it('shares a staff link and QR code, never for Admin, and removes someone who joined', async () => {
    renderPeople(view(), { links: [staffLink(), staffLink({ id: 60, status: 'EXPIRED', code: null, path: null })], url: '/?invite=link' });
    await screen.findByLabelText('Staff link');
    const dialog = screen.getByRole('dialog', { name: 'Invite to a job' });
    expect(within(dialog).getByRole('radio', { name: /Share a staff link/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByRole('button', { name: 'Head coach' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/staffcode`);
    expect(within(dialog).getByTitle(/QR code/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 of 10 uses left/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Tamar Lomidze' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/jobs/120/end', { revision: 2 }));
    expect(await within(dialog).findByText(/Nobody yet/)).toBeInTheDocument();

    api.post.mockResolvedValueOnce({ data: staffLink({ id: 71, code: 'newcode', path: '/staff-invite/newcode', uses: 0, joined: [] }) });
    fireEvent.click(within(dialog).getByRole('button', { name: /New link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/staff-links', { requestId: expect.any(String), job: 'HEAD_COACH', title: 'Head coach', tools: null, clubWide: true, squadIds: [] }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/7/staff-links/70'));
    expect(await within(dialog).findByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/newcode`);

    // Admin is sent to one person only: the link way closes.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Admin' }));
    expect(within(dialog).getByRole('radio', { name: /Share a staff link/ })).toBeDisabled();
    expect(within(dialog).queryByLabelText('Staff link')).not.toBeInTheDocument();
});

it('an admin changes a job at once, sees where it came from, and can end an Admin but never the Owner', async () => {
    renderPeople(view());
    expect(await screen.findByText('The invite for Luka was accepted by Giga')).toBeInTheDocument();
    const giga = row('Giga Kapanadze');
    expect(within(giga).getByText(/Changed by Nino/)).toBeInTheDocument();
    fireEvent.click(within(giga).getByRole('button', { name: /History/ }));
    expect(within(giga).getByText('Changed · Team manager: Assistant coach → Team manager · U12')).toBeInTheDocument();

    fireEvent.click(within(giga).getByRole('button', { name: 'Change' }));
    const form = within(giga).getByRole('form');
    expect(within(form).queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Head coach' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/clubs/7/people/jobs/10', {
        job: 'HEAD_COACH', title: null, tools: null, clubWide: false, squadIds: [5], revision: 0,
    }));
    expect(await screen.findByText('Giga Kapanadze: Head coach · U12. Changed now.')).toBeInTheDocument();

    expect(within(row('Nino Owner')).queryByRole('button', { name: /Remove|End job/ })).not.toBeInTheDocument();
    fireEvent.click(within(row('Mari Admin')).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'End job' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/admins/4/end'));
});

it('a head coach suggests a helper for their own squad through the same Invite, and changes nobody’s job', async () => {
    renderPeople(view({ userId: 4, leader: false, owner: false, headCoachSquads: [5] }));
    expect(await screen.findByText('Luka Beridze')).toBeInTheDocument();
    for (const name of [/^Change$/, /Post a job/, /Add job/]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    const dialog = screen.getByRole('dialog', { name: 'Suggest a helper' });
    expect(within(dialog).getByText(/For a squad you coach/)).toBeInTheDocument();
    for (const other of ['Head coach', 'Fees', 'Admin', 'U14']) expect(within(dialog).queryByRole('button', { name: other })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Team manager' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Dato Kvaratskhelia' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'dato@example.test' } });
    api.post.mockResolvedValueOnce({ data: { userId: null, name: 'Dato Kvaratskhelia', inApp: true, link: null, status: 'SUGGESTED' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/invites', {
        name: 'Dato Kvaratskhelia', email: 'dato@example.test', job: 'TEAM_MANAGER', title: null, tools: null, clubWide: false, squadIds: [5],
    }));
    expect(await screen.findByText(/An admin confirms or declines it/)).toBeInTheDocument();
});

it('an admin confirms a suggested helper from Needs you and gets the link to send', async () => {
    renderPeople(view({}, [suggested]));
    const needs = await screen.findByRole('list', { name: 'Needs you' });
    expect(within(needs).getByText('Giorgi suggests Dato Kvaratskhelia')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Staff' })).queryByText('Dato Kvaratskhelia')).toBeNull();
    api.post.mockResolvedValueOnce({ data: { appointmentId: 55, outcome: 'CONFIRMED', answeredBy: 'Nino Owner', link: { token: 'dato.tok', expiresAt: '2026-11-02T12:00:00' } } });
    fireEvent.click(within(needs).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/people/suggestions/55', { confirm: true, revision: 3 }));
    expect(await screen.findByLabelText('Invite link for Dato Kvaratskhelia')).toBeInTheDocument();
});

it('gives a colleague Staff to read: who, which job, where, and nothing to change', async () => {
    renderPeople(view({ userId: 4, leader: false, owner: false, headCoachSquads: [] }), {
        access: { clubId: 7, squadId: null, allowed: ['see_staff', 'follow'], admins: [{ userId: 1, name: 'Nino Owner' }], refused: [
            { action: 'invite_staff', allowed: false, reason: 'ONLY_ADMINS', message: 'Only the club’s admins can do this.', because: null },
            { action: 'suggest_assistant', allowed: false, reason: 'ONLY_HEAD_COACHES', message: 'Only head coaches can do this.', because: null }] },
    });
    expect(within(await screen.findByRole('list', { name: 'Staff' })).getByText('Team manager')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/access/clubs/7', expect.anything()));
    for (const name of [/^Invite$/, /Post a job/, /^Change$/, /End job/, /^Remove$/, /Add job/, /New link/]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Needs you' })).not.toBeInTheDocument();
    // No explanations: Staff is read-only for colleagues, so nothing says what they may not do.
    expect(screen.queryByText('Only the club’s admins can do this.')).not.toBeInTheDocument();
});

it('shows each colleague’s shared email and phone, and your own switches on your row only', async () => {
    const data = view({ userId: 3, leader: false, owner: false, hidePhone: true });
    data.people[1] = { ...data.people[1], phone: '555123456' };
    auth.user = { id: 3, dob: '1985-01-01' };
    renderPeople(data);
    const luka = (await screen.findByText('Luka Beridze')).closest('li.pp-person') as HTMLElement;
    expect(within(luka).getByRole('link', { name: 'luka@example.test' })).toHaveAttribute('href', 'mailto:luka@example.test');
    expect(within(luka).getByRole('link', { name: '+995 555 12 34 56' })).toHaveAttribute('href', 'tel:555123456');
    expect(within(luka).queryByRole('switch')).not.toBeInTheDocument();
    // No phone yet: it is added on your profile, where Staff's link opens it.
    const me = row('Giga Kapanadze');
    expect(within(me).getByRole('switch', { name: 'My email' })).toBeChecked();
    expect(within(me).queryByRole('switch', { name: 'My phone' })).not.toBeInTheDocument();
    expect(within(me).getByRole('link', { name: 'Add your phone on your profile' })).toHaveAttribute('href', '/profile/3?edit=phone');
    fireEvent.click(within(me).getByRole('switch', { name: 'My email' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/clubs/7/people/me/contact', { hideEmail: true, hidePhone: true }));
    expect(await screen.findByText('Saved. Colleagues see what you share.')).toBeInTheDocument();
});

it('lets you show or hide the phone you added on your profile', async () => {
    const data = view({ userId: 3, leader: false, owner: false, hidePhone: true });
    data.people[2] = { ...data.people[2], phone: '+995 599 00 11 22' };
    auth.user = { id: 3, dob: '1985-01-01' };
    renderPeople(data);
    await screen.findByText('Giga Kapanadze');
    const me = row('Giga Kapanadze');
    expect(within(me).queryByRole('link', { name: /Add your phone/ })).not.toBeInTheDocument();
    fireEvent.click(within(me).getByRole('switch', { name: 'My phone' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/clubs/7/people/me/contact', { hideEmail: false, hidePhone: false }));
    expect(await within(row('Giga Kapanadze')).findByRole('switch', { name: 'My phone' })).toBeChecked();
});

it('shows who is on duty today and the club’s outside specialists, opening Duties and Specialists for those who use them', async () => {
    const data = view();
    data.people[2] = { ...data.people[2], onDuty: [{ id: 81, title: 'First aid', startsAt: '2026-10-28T16:00:00', endsAt: '2026-10-28T18:00:00', location: 'Pitch 1' }] };
    data.specialists = [{ id: 91, name: 'Eka Beridze', specialisation: 'Sports psychologist', contact: 'eka@example.test', startsAt: '2026-09-01', endsAt: null }];
    renderPeople(data, { tools: { duties: true, specialists: true } });
    const duty = within(await screen.findByText('Giga Kapanadze').then(() => row('Giga Kapanadze'))).getByRole('link', { name: /On duty today.*Pitch 1/ });
    expect(duty).toHaveAttribute('href', '/clubs/7/office?tab=tools&tool=staff-duties&record=81');
    expect(screen.getByRole('link', { name: 'Eka Beridze' })).toHaveAttribute('href', '/clubs/7/office?tab=tools&tool=specialists&record=91');
    expect(screen.getByText('Sports psychologist · outside specialist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'eka@example.test' })).toHaveAttribute('href', 'mailto:eka@example.test');
});

it('lists older club invitations nobody answered as Waiting, with Cancel for admins', async () => {
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) throw new Error('no rule-checker');
        if (path.endsWith('/staff-links')) return { data: [] };
        return { data: view() };
    });
    const invitation = { id: 501, userId: 40, username: 'sandro', fullName: 'Sandro Gelashvili', role: 'PLAYER', status: 'PENDING', createdAt: '2026-10-20T09:00:00' };
    render(<MemoryRouter><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" invitations={[invitation] as never} /></MemoryRouter>);
    const sandro = (await screen.findByText('Sandro Gelashvili')).closest('li.pp-person') as HTMLElement;
    expect(within(sandro).getByText('Waiting')).toBeInTheDocument();
    fireEvent.click(within(sandro).getByRole('button', { name: 'Cancel the invitation for Sandro Gelashvili' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() => expect(api.delete.mock.calls.length + api.post.mock.calls.length).toBeGreaterThan(0));
});

it('asks to confirm the email first when the server refuses an invite for it', async () => {
    renderPeople(view(), { url: '/?invite=person' });
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Tamar Lomidze' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'tamar@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'U12' }));
    api.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: { code: 'EMAIL_CONFIRMATION_REQUIRED', action: 'INVITE', message: 'Confirm your email first.' } } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Confirm your email first', expect.objectContaining({ action: expect.objectContaining({ label: 'Resend' }) })));
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});

it('opens the staff link even when the links fail to load, with Try again', async () => {
    let fail = true;
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) throw new Error('no rule-checker');
        if (path.endsWith('/staff-links')) { if (fail) throw new Error('down'); return { data: [staffLink()] }; }
        return { data: view() };
    });
    render(<MemoryRouter initialEntries={['/?invite=link']}><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
    const dialog = await screen.findByRole('dialog', { name: 'Invite to a job' });
    expect(within(dialog).queryByRole('button', { name: /Make the link/ })).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/staffcode`);
});

it('New link shows the new link even if switching off the old one fails, and offers Switch off for it', async () => {
    renderPeople(view(), { links: [staffLink()], url: '/?invite=link' });
    await screen.findByLabelText('Staff link');
    const dialog = screen.getByRole('dialog', { name: 'Invite to a job' });
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
    expect(await screen.findByRole('button', { name: 'Invite' })).toBeDisabled();
    answer({ data: { clubId: 7, squadId: null, allowed: ['see_staff', 'invite_staff', 'make_admin', 'change_job', 'end_job'], refused: [] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled());
});

it('says plainly when a person has their own account and so gets no link', async () => {
    renderPeople(view());
    const luka = (await screen.findByText('Luka Beridze')).closest('li') as HTMLElement;
    api.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'NOT_AN_INVITE_ACCOUNT', message: 'Not an invite account.' } } });
    fireEvent.click(within(luka).getByRole('button', { name: /New link/ }));
    expect(await screen.findByText(/Luka Beridze has their own account, so there’s no link to send/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('Post a job opens the club’s jobs inside Staff, with the way back', async () => {
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) throw new Error('no rule-checker');
        return { data: path === '/clubs/7/people' ? view() : [] };
    });
    render(<MemoryRouter><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
    const post = await screen.findByRole('button', { name: /Post a job/ });
    await waitFor(() => expect(post).toBeEnabled());
    fireEvent.click(post);
    fireEvent.click(await screen.findByRole('button', { name: 'Staff' }));
    expect(await screen.findByRole('list', { name: 'Staff' })).toBeInTheDocument();
});

const showAt = (data: PeopleView, me: number) => {
    auth.user = { id: me, dob: '1985-01-01' };
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/')) throw new Error('no rule-checker');
        if (path.endsWith('/staff-links')) return { data: [] };
        if (path === '/me/club-relationships') return { data: [{ clubId: 7, departureSnapshots: { STAFF: 'snap' } }] };
        return { data };
    });
    return render(<MemoryRouter initialEntries={['/people']}><Routes>
        <Route path="/people" element={<ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" />} />
        <Route path="/clubs/7" element={<p>Club page</p>} /><Route path="/home" element={<p>Home page</p>} />
    </Routes></MemoryRouter>);
};

it('Leave on your own only job leaves the club and lands on its page', async () => {
    showAt(view({ userId: 3, leader: false, owner: false, headCoachSquads: [] }), 3);
    const me = (await screen.findByText('Giga Kapanadze')).closest('li') as HTMLElement;
    fireEvent.click(within(me).getByRole('button', { name: 'Leave' }));
    const dialog = await screen.findByRole('dialog', { name: 'Leave FC Dinamo Tbilisi Academy?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave FC Dinamo Tbilisi Academy' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/relationships/STAFF/leave', { requestId: expect.any(String), snapshot: 'snap' }));
    expect(await screen.findByText('Club page')).toBeInTheDocument();
});

it('the Owner hands the club over to an Admin at once, then may leave', async () => {
    showAt(view(), 1);
    const owner = (await screen.findByText('Nino Owner')).closest('li') as HTMLElement;
    fireEvent.click(within(owner).getByRole('button', { name: /Hand the club over/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Hand FC Dinamo Tbilisi Academy over' });
    api.post.mockResolvedValueOnce({ data: { outcome: 'TRANSFERRED', handoverId: 3 } });
    fireEvent.click(await within(dialog).findByRole('button', { name: /Mari Admin.*takes over at once/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/ownership/handover', { userId: 4 }));
    expect(await screen.findByText('Mari Admin owns FC Dinamo Tbilisi Academy now; you’re an Admin.')).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Leave FC Dinamo Tbilisi Academy?' })).toBeInTheDocument();
});

it('the last staff member closes the club after a plain confirmation of what is kept', async () => {
    showAt(view(), 1);
    await screen.findByText('Nino Owner');
    api.post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { code: 'OWNER_MUST_HAND_OVER', lastStaff: true } } });
    fireEvent.click(within(row('Nino Owner')).getByRole('button', { name: /Hand the club over/ }));
    const handover = await screen.findByRole('dialog', { name: 'Hand FC Dinamo Tbilisi Academy over' });
    fireEvent.click(within(handover).getByRole('button', { name: 'Not now' }));
    // Leaving as the Owner with nobody else answers OWNER_MUST_HAND_OVER lastStaff: closing is offered.
    render(<MemoryRouter initialEntries={['/people?leave=7:leave']}><Routes>
        <Route path="/people" element={<ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" />} /><Route path="/home" element={<p>Home page</p>} />
    </Routes></MemoryRouter>);
    const leave = await screen.findByRole('dialog', { name: 'Leave FC Dinamo Tbilisi Academy?' });
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave FC Dinamo Tbilisi Academy' }));
    const close = await screen.findByRole('alertdialog', { name: 'Close FC Dinamo Tbilisi Academy?' });
    expect(within(close).getByText('Kept: the club’s history, its events and records, and the jobs that ended.')).toBeInTheDocument();
    fireEvent.click(within(close).getByRole('button', { name: /Close the club/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/7/dissolve'));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
});

it('opens only the leave dialog for the club named in the address', async () => {
    auth.user = { id: 1, dob: '1985-01-01' };
    renderPeople(view(), { url: '/?leave=9:leave' });
    await screen.findByText('Nino Owner');
    expect(screen.queryByRole('dialog', { name: /Leave FC Dinamo Tbilisi Academy/ })).not.toBeInTheDocument();
    cleanup();
    renderPeople(view(), { url: '/?leave=7:leave' });
    expect(await screen.findByRole('dialog', { name: 'Leave FC Dinamo Tbilisi Academy?' })).toBeInTheDocument();
});

it('the handover list offers Try again when the club’s people fail to load', async () => {
    auth.user = { id: 1, dob: '1985-01-01' };
    let peopleReads = 0;
    api.get.mockImplementation(async (path: string) => {
        if (path.startsWith('/access/') || path.endsWith('/ownership')) throw new Error('none');
        if (path.endsWith('/staff-links')) return { data: [] };
        peopleReads += 1;
        // The dialog's read comes first (a child's effect runs before its page's).
        if (peopleReads === 1) throw new Error('down');
        return { data: view() };
    });
    render(<MemoryRouter initialEntries={['/?leave=7:handover']}><ClubPeople clubId={7} clubName="FC Dinamo Tbilisi Academy" /></MemoryRouter>);
    const dialog = await screen.findByRole('dialog', { name: 'Hand FC Dinamo Tbilisi Academy over' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByRole('button', { name: /Mari Admin.*takes over at once/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
});

it.each(['CUSTOM', 'SPECIALIST_COACH'])('an older %s link opens with its own job, to share or switch off but never renew', async job => {
    const old = staffLink({ job, title: 'Individual coaching', tools: ['ATTENDANCE:WRITE'] });
    renderPeople(view(), { links: [old], url: '/?invite=link' });
    expect(await screen.findByLabelText('Staff link')).toHaveValue(`${window.location.origin}/staff-invite/staffcode`);
    const dialog = screen.getByRole('dialog', { name: 'Invite to a job' });
    expect(within(dialog).queryByRole('button', { name: /New link/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch off' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/7/staff-links/70'));
    expect(api.post).not.toHaveBeenCalledWith('/clubs/7/staff-links', expect.anything());
});

it('Share a staff link opens the newest link with its job and where, ready to share', async () => {
    renderPeople(view({ owner: false, headCoachSquads: [] }), { links: [staffLink()] });
    fireEvent.click(await screen.findByRole('button', { name: 'Invite' }));
    fireEvent.click(screen.getByRole('radio', { name: /Share a staff link/ }));
    expect(await screen.findByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/staffcode');
    expect(screen.getByRole('button', { name: 'Whole club' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /Make the link/ })).not.toBeInTheDocument();
});
