import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiClient } from '../../api/axiosConfig';
import { ProfessionalCareer } from './ProfessionalCareer';
import { ProfileCareer } from './ProfileCareer';
import { profileRoles, type FootballProfile } from './domain';

vi.mock('../../api/axiosConfig', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/ui/MediaImage', () => ({ MediaImage: () => null }));
const initial: FootballProfile = {
    roles: ['COACH', 'CLUB_STAFF'],
    appointments: [{ clubId: 3, clubName: 'Dinamo Academy', logoUrl: null, role: 'OWNER', title: 'Academy director', coaching: true, memberSince: '2024-09-01', biography: 'Developing players', qualifications: null, squads: ['U16 Boys', 'U16 Girls'] }],
    entries: [{ id: 11, role: 'COACH', kind: 'POSITION', title: 'Youth coach', organization: 'Earlier academy', startsOn: '2021-09-01', endsOn: '2024-06-01', description: 'Player development', published: true }],
};
beforeEach(() => vi.resetAllMocks());
const show = (own = true, value = initial) => render(<MemoryRouter><ProfessionalCareer initial={value} userId={7} own={own} /></MemoryRouter>);

it('uses football identity instead of old account permissions, including a secondary player role', () => {
    expect(profileRoles({ role: 'ORGANIZER', footballProfile: initial })).toEqual(['COACH', 'CLUB_STAFF']);
    expect(profileRoles({ role: 'PARENT', roleProfiles: [{ role: 'PARENT', primary: true, published: true }, { role: 'PLAYER', primary: false, published: true }] })).toContain('PLAYER');
    expect(profileRoles({ role: 'ORGANIZER', footballProfile: { roles: [], entries: [], appointments: [] } })).toEqual([]);
});

it('shows owner and coach together with actual teams and career chronology', () => {
    show(false);
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getAllByText('Coach').length).toBeGreaterThan(0);
    expect(screen.getByText('U16 Girls')).toBeInTheDocument();
    expect(screen.getByText('Earlier academy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dinamo Academy' })).toHaveAttribute('href', '/clubs/3');
    expect(screen.queryByRole('button', { name: 'Add career entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Youth coach' })).not.toBeInTheDocument();
    expect(screen.queryByText('Goals')).not.toBeInTheDocument();
});

it.each(['FAN', 'PARENT', 'VENUE_MANAGER', 'ORGANIZER'])('keeps %s profiles simple and makes no professional-data requests', role => {
    render(<MemoryRouter><ProfileCareer profile={{ id: 7, role, footballProfile: { roles: [role], appointments: [], entries: [] } }} isMyProfile /></MemoryRouter>);
    expect(screen.queryByText('Career & qualifications')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
});

it('offers every professional role a career and retains hidden entries for their owner', () => {
    for (const role of ['PLAYER', 'COACH', 'REFEREE', 'AGENT', 'CLUB_STAFF']) {
        const view = show(true, { roles: [role], appointments: [], entries: [] });
        expect(screen.getByRole('button', { name: 'Add career entry' })).toBeInTheDocument();
        view.unmount();
    }
    show(true, { ...initial, roles: ['FAN'] });
    expect(screen.getByText('Hidden · role not published')).toBeInTheDocument();
});

it('saves a draft with dates and keeps the changed profile available to the parent', async () => {
    const onChanged = vi.fn();
    vi.mocked(apiClient.post).mockResolvedValue({ data: initial });
    render(<MemoryRouter><ProfessionalCareer initial={initial} userId={7} own onChanged={onChanged} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Add career entry' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Assistant coach' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/users/me/career', expect.objectContaining({ role: 'COACH', title: 'Assistant coach', startsOn: '2020-08-01', endsOn: null, published: false })));
    expect(await screen.findByRole('status')).toHaveTextContent('Career entry saved.');
    expect(onChanged).toHaveBeenCalledWith(initial);
});

it('retains the edited draft after a failed save and can retry', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: initial });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Youth coach' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Senior youth coach' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your draft is still here');
    expect(screen.getByLabelText('Title')).toHaveValue('Senior youth coach');
    fireEvent.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Career entry saved');
    expect(apiClient.put).toHaveBeenCalledTimes(2);
});

it('requires explicit removal and updates the timeline after deletion', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { ...initial, entries: [] } });
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Youth coach' }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep entry' }));
    expect(screen.getByText('Youth coach')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Youth coach' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry' }));
    await waitFor(() => expect(screen.queryByText('Youth coach')).not.toBeInTheDocument());
    expect(apiClient.delete).toHaveBeenCalledWith('/users/me/career/11');
});

it('labels qualifications as self-reported and gives qualifications their own dates', () => {
    show(true, { ...initial, entries: [{ ...initial.entries[0], kind: 'QUALIFICATION', title: 'Coaching course', endsOn: '2025-01-01' }] });
    expect(screen.getByText('Self-reported')).toBeInTheDocument();
    expect(screen.getByText(/does not verify it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Coaching course' }));
    expect(screen.getByLabelText('Awarded on')).toBeInTheDocument();
    expect(screen.getByLabelText('Valid until (optional)')).toBeInTheDocument();
});

it('does not render professional data on a private profile for a visitor', () => {
    render(<MemoryRouter><ProfileCareer profile={{ id: 7, role: 'COACH', isPrivate: true, footballProfile: initial }} isMyProfile={false} /></MemoryRouter>);
    expect(screen.queryByText('Dinamo Academy')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
});

it('keeps an agent career usable while the separate agent workspace is unavailable', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404, data: { code: 'FEATURE_UNAVAILABLE' } } });
    render(<MemoryRouter><ProfileCareer profile={{ id: 7, role: 'AGENT', footballProfile: { roles: ['AGENT'], entries: [], appointments: [] } }} isMyProfile={false} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Player representation' })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Career & qualifications' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
