import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InviteStaffDialog } from './InviteStaffDialog';
import { staffLinkMatches, type JobDraft, type PeopleView, type StaffLink } from './api';

const api = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));
vi.mock('../../../api/axiosConfig', () => ({ apiClient: api, DEPLOYMENT_URLS: { mediaBaseUrl: '' } }));
const view: PeopleView = { viewer: { userId: 1, leader: true, owner: true, headCoachSquads: [] }, people: [], nameChecks: [], tools: [],
    squads: [{ id: 5, name: 'U12' }], jobs: [{ key: 'HEAD_COACH', title: 'Head coach', tools: [], description: '' }], moreJobs: [] };
const link = (id: number, title: string): StaffLink => ({ id, job: 'SPECIALIST_COACH', title, tools: ['ATTENDANCE:READ'], clubWide: false, squads: view.squads,
    status: 'ACTIVE', code: 'code' + id, path: '/staff-invite/code' + id, uses: 0, maxUses: 10, expiresAt: '2026-11-02T12:00:00', createdAt: '2026-10-28T12:00:00', createdById: 1, createdByName: 'Luka', joined: [] });
const goalkeeper = link(70, 'Goalkeeper coach'), conditioning = link(71, 'Conditioning coach');
const draft: JobDraft = { job: conditioning.job, title: conditioning.title, tools: conditioning.tools!, clubWide: false, squadIds: [5] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('matches title and squads, and matches the exact tool set for legacy Custom links', () => {
    expect(staffLinkMatches(goalkeeper, draft, view)).toBe(false);
    expect(staffLinkMatches(conditioning, draft, view)).toBe(true);
    expect(staffLinkMatches(conditioning, { ...draft, squadIds: [6] }, view)).toBe(false);
    expect(staffLinkMatches({ ...conditioning, job: 'CUSTOM' }, { ...draft, job: 'CUSTOM', tools: ['ATTENDANCE:WRITE'] }, view)).toBe(false);
    expect(staffLinkMatches({ ...conditioning, job: 'CUSTOM', tools: ['ATTENDANCE:READ', 'ATTENDANCE:WRITE'] }, { ...draft, job: 'CUSTOM', tools: ['ATTENDANCE:WRITE', 'ATTENDANCE:READ'] }, view)).toBe(true);
});
function Harness() {
    const [links, setLinks] = useState([goalkeeper, conditioning]);
    return <InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={view} suggest={false} allowAdmin how="link" onHow={() => {}} links={links} openedLink={71} onLinks={setLinks}
        onClose={() => {}} onChanged={() => {}} onInvited={() => {}} />;
}
it('shares an older specialist link with its saved title, and never makes a new one for that job', async () => {
    api.post.mockResolvedValue({ data: link(72, conditioning.title) }); api.delete.mockResolvedValue({ data: {} });
    render(<Harness />);
    expect(screen.getByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code71');
    expect(decodeURIComponent(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!)).toContain('Conditioning coach');
    expect(screen.queryByRole('button', { name: /New link/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Switch off/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/1/staff-links/71'));
    expect(api.delete).not.toHaveBeenCalledWith('/clubs/1/staff-links/70');
    expect(api.post).not.toHaveBeenCalled();
});

it('chooses the job first: a staff link never makes an Admin, sending to one person does', () => {
    const admin: PeopleView = { ...view, jobs: [...view.jobs, { key: 'ADMIN', title: 'Admin', tools: [], description: '' }] };
    render(<InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={admin} suggest={false} allowAdmin how="person" onHow={() => {}} links={[]} onLinks={() => {}}
        onClose={() => {}} onChanged={() => {}} onInvited={() => {}} />);
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Share a staff link/ })).toHaveTextContent('Never Admin');
    expect(screen.getByRole('radio', { name: /Send to one person/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

it('lets a head coach suggest a helper only for the squads they coach, with no link', async () => {
    api.post.mockResolvedValue({ data: { userId: null, name: 'Nika', inApp: true, link: null, status: 'SUGGESTED' } });
    const coach: PeopleView = { ...view, viewer: { ...view.viewer, leader: false, owner: false, headCoachSquads: [5] }, squads: [{ id: 5, name: 'U12' }, { id: 6, name: 'U14' }],
        jobs: [{ key: 'ASSISTANT_COACH', title: 'Assistant coach', tools: [], description: '' }, { key: 'TEAM_MANAGER', title: 'Team manager', tools: [], description: '' }] };
    const invited = vi.fn();
    render(<InviteStaffDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={coach} suggest allowAdmin={false} how="person" onHow={() => {}} links={[]} onLinks={() => {}}
        onClose={() => {}} onChanged={() => {}} onInvited={invited} />);
    expect(screen.queryByRole('radio', { name: /Share a staff link/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'U14' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Whole club' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nika' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nika@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send suggestion' }));
    await waitFor(() => expect(invited).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/clubs/1/people/invites', expect.objectContaining({ job: 'ASSISTANT_COACH', clubWide: false, squadIds: [5] }));
});
