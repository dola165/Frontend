import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InviteStaffDialog } from './InviteStaffDialog';
import type { PeopleView, StaffLink } from './api';

const api = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const view: PeopleView = { viewer: { userId: 1, leader: true, owner: true, headCoachSquads: [] }, people: [], nameChecks: [], tools: [],
    squads: [{ id: 5, name: 'U12' }], jobs: [{ key: 'HEAD_COACH', title: 'Head coach', tools: [], description: '' }], moreJobs: [] };
const link = (id: number, invitedName: string): StaffLink => ({ id, job: 'HEAD_COACH', title: 'Head coach', tools: [], clubWide: false, squads: view.squads,
    status: 'ACTIVE', code: 'code' + id, path: '/staff-invite/code' + id, expiresAt: '2026-11-07T12:00:00', createdAt: '2026-11-04T12:00:00', createdById: 1, createdByName: 'Luka',
    invitedName, invitedEmail: null, invitedPhone: '+995 555 12 34 56' });
const ana = link(70, 'Ana Beridze'), rezi = link(71, 'Rezi Lomidze');
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Harness({ opened = null as number | null, first = [ana, rezi] }) {
    const [links, setLinks] = useState(first);
    return <InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={view} allowAdmin how="link" onHow={() => {}} links={links} openedLink={opened} onLinks={setLinks}
        initial={{ job: 'HEAD_COACH', clubWide: false, squadIds: [5] }} onClose={() => {}} onChanged={() => {}} onInvited={() => {}} />;
}

it('makes a link for the person named, by email or phone, and shows it to share', async () => {
    api.post.mockResolvedValue({ data: link(72, 'Nino Kapanadze') });
    render(<Harness first={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Make the link/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter their name.');
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Nino Kapanadze' } });
    fireEvent.click(screen.getByRole('button', { name: /Make the link/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter their email or phone.');
    fireEvent.change(screen.getByLabelText(/Their email or phone/), { target: { value: 'nino@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /Make the link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/1/staff-links', expect.objectContaining({ name: 'Nino Kapanadze', email: 'nino@example.test', squadIds: [5] })));
    expect(await screen.findByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code72');
    expect(decodeURIComponent(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!)).toContain('Nino Kapanadze');
    expect(screen.getByText(/For Nino Kapanadze · works once/)).toBeInTheDocument();
});

it('a phone goes as a phone', async () => {
    api.post.mockResolvedValue({ data: link(72, 'Nino Kapanadze') });
    render(<Harness first={[]} />);
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Nino Kapanadze' } });
    fireEvent.change(screen.getByLabelText(/Their email or phone/), { target: { value: '+995 555 12 34 56' } });
    fireEvent.click(screen.getByRole('button', { name: /Make the link/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/clubs/1/staff-links', expect.objectContaining({ phone: '+995 555 12 34 56' })));
});

it('never makes a staff link for Head of coaching, More jobs or Custom: only the four main jobs', () => {
    const all: PeopleView = { ...view, jobs: ['HEAD_COACH', 'ASSISTANT_COACH', 'TEAM_MANAGER', 'FEES', 'ADMIN'].map(key => ({ key, title: key === 'FEES' ? 'Fees' : key === 'ADMIN' ? 'Admin' : key.charAt(0) + key.slice(1).toLowerCase().replace('_', ' '), tools: [], description: '' })),
        moreJobs: [{ key: 'HEAD_OF_COACHING', title: 'Head of coaching', tools: [], description: '', family: 'COACHING' }, { key: 'GOALKEEPER_COACH', title: 'Goalkeeper coach', tools: [], description: '', family: 'COACHING' }] };
    render(<InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={all} allowAdmin how="link" onHow={() => {}} links={[]} onLinks={() => {}}
        onClose={() => {}} onChanged={() => {}} onInvited={() => {}} />);
    const linkWay = () => screen.getByRole('radio', { name: /Share a staff link/ });
    expect(linkWay()).toBeEnabled();
    expect(screen.getByRole('button', { name: /Make the link/ })).toBeInTheDocument();
    const refused = () => {
        expect(linkWay()).toBeDisabled();
        expect(linkWay()).toHaveTextContent(/Only for .*Head coach.*Assistant coach.*Team manager.*Fees/);
        expect(screen.queryByRole('button', { name: /Make the link/ })).not.toBeInTheDocument();
    };
    fireEvent.click(screen.getByRole('button', { name: 'More jobs' }));
    refused();
    fireEvent.change(screen.getByLabelText('More jobs'), { target: { value: 'GOALKEEPER_COACH' } });
    refused();
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    refused();
    expect(api.post).not.toHaveBeenCalled();
});

it('lists every working link by who it is for, each with Show and Switch off', async () => {
    api.delete.mockResolvedValue({ data: {} });
    render(<Harness opened={71} />);
    expect(screen.getByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code71');
    const list = screen.getByRole('region', { name: 'Working links' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ana Beridze');
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Show the link for Ana Beridze' }));
    expect(screen.getByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code70');
    fireEvent.click(within(list).getByRole('button', { name: 'Switch off the link for Rezi Lomidze' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/1/staff-links/71'));
    expect(api.delete).not.toHaveBeenCalledWith('/clubs/1/staff-links/70');
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Working links' })).getAllByRole('listitem')).toHaveLength(1));
});

it('chooses the job first: a staff link never makes an Admin, sending to one person does', () => {
    const admin: PeopleView = { ...view, jobs: [...view.jobs, { key: 'ADMIN', title: 'Admin', tools: [], description: '' }] };
    render(<InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={admin} allowAdmin how="person" onHow={() => {}} links={[]} onLinks={() => {}}
        onClose={() => {}} onChanged={() => {}} onInvited={() => {}} />);
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toHaveTextContent('Never Admin');
    expect(screen.getByRole('radio', { name: /Send to one person/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
});
