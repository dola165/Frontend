import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { ProfileCareer } from './ProfileCareer';
import { RefereePage } from '../../pages/RefereePage';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/ui/MediaImage', () => ({ MediaImage: () => null }));
vi.mock('../../utils/resolveMediaUrl', () => ({ resolveMediaUrl: (url: string) => url }));

const referee = {
    user_id: 7, full_name: 'Tamar', published: true, biography: 'Youth match official.',
    qualifications: 'Regional referee course', formats: '7_A_SIDE', languages: 'Georgian', service_area: 'Tbilisi',
    accepts_paid: true, accepts_volunteer: true, fee: 40, currency: 'GEL', timezone: 'Asia/Tbilisi', revision: 1,
    career: [{ id: 1, kind: 'VOLUNTEERING', title: 'Community cup', organization: 'Youth football', starts_on: '2025-05-01', ends_on: null, description: 'Weekend matches' }],
    match_history: [{ id: 8, title: 'U12 final', starts_at: '2026-01-12T12:00:00', timezone: 'Asia/Tbilisi', duty: 'REFEREE', volunteer: true, club_name: 'Academy', opponent_name: 'Visitors' }],
};
beforeEach(() => vi.resetAllMocks());

it('shows referee career and completed fixtures directly, with editing only for the owner', async () => {
    vi.mocked(apiClient.get).mockImplementation(async path => ({ data: path.includes('coaching-career') ? [] : referee }));
    const view = render(<MemoryRouter><ProfileCareer profile={{ id: 7, role: 'REFEREE' }} isMyProfile={false} /></MemoryRouter>);
    expect(await screen.findByText('Community cup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'U12 final' })).toHaveAttribute('href', '/match-exchange/8');
    expect(screen.queryByRole('button', { name: 'Edit referee details' })).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><ProfileCareer profile={{ id: 7, role: 'REFEREE' }} isMyProfile /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add career, qualification or volunteering' }));
    expect(screen.getByRole('heading', { name: 'Add experience' })).toBeInTheDocument();
});

it('does not request private career data for another viewer', () => {
    render(<MemoryRouter><ProfileCareer profile={{ id: 7, role: 'REFEREE', isPrivate: true }} isMyProfile={false} /></MemoryRouter>);
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

it('shows a coach’s real club position and squad without player statistics', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ club_id: 3, club_name: 'Riverside', title: 'Head coach', logo_url: null, member_since: '2025-09-01T10:00:00', biography: 'Academy development', qualifications: 'Coaching certificate', squads_json: '[{"id":2,"name":"U12"}]' }] });
    render(<MemoryRouter><ProfileCareer profile={{ id: 4, role: 'COACH' }} isMyProfile={false} /></MemoryRouter>);
    expect(await screen.findByText('Head coach')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Riverside' })).toHaveAttribute('href', '/clubs/3');
    expect(screen.getByText('Coaching certificate')).toBeInTheDocument();
    expect(screen.getByText('Current squads:')).toBeInTheDocument();
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
});

it('redirects the previous public referee URL to the normal profile', async () => {
    render(<MemoryRouter initialEntries={['/referees/7']}><Routes>
        <Route path="/referees/:refereeId" element={<RefereePage />} />
        <Route path="/profile/:id" element={<h1>Main profile</h1>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Main profile' })).toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
});
