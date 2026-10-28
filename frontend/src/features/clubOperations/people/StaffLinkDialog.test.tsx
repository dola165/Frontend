import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StaffLinkDialog } from './StaffLinkDialog';
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
    return <StaffLinkDialog club={1} clubName="FC Dinamo Tbilisi Academy" view={view} links={links} opened={71} onLinks={setLinks} onClose={() => {}} onChanged={() => {}} />;
}
it('shares the saved title and renews only that title, retaining another specialist link', async () => {
    api.post.mockResolvedValue({ data: link(72, conditioning.title) }); api.delete.mockResolvedValue({ data: {} });
    render(<Harness />);
    expect(screen.getByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code71');
    expect(decodeURIComponent(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!)).toContain('Conditioning coach');
    expect(screen.queryByLabelText('Name of the job')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'U12' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /New link/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clubs/1/staff-links/71'));
    expect(api.delete).not.toHaveBeenCalledWith('/clubs/1/staff-links/70');
    expect(screen.getByLabelText('Staff link')).toHaveValue(window.location.origin + '/staff-invite/code72');
});
