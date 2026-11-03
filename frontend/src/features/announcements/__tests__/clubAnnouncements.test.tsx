import '../../../i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../clubApi';
import { ClubAnnouncementsBox } from '../ClubAnnouncementsBox';
import { ClubPinned } from '../ClubPinned';

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 1 } }) }));
vi.mock('../clubApi', () => ({ clubAnnouncements: vi.fn(), announceToClub: vi.fn(), endClubAnnouncement: vi.fn(), myClubAnnouncements: vi.fn() }));

const soon = new Date(Date.now() + 3 * 86400000).toISOString();
const announcement = (over: Partial<api.ClubAnnouncement> = {}): api.ClubAnnouncement => ({ id: 4, clubId: 1, clubName: 'Dinamo', title: 'Pitch closed Saturday', body: 'Use the hall.',
    squadIds: [], squadNames: [], authorName: 'Nino', createdAt: new Date().toISOString(), expiresAt: soon, pinned: true, told: null, canEnd: false, ...over });

beforeEach(() => vi.clearAllMocks());

it('lets a leader announce to the whole club with a week’s pin, and says how many heard it', async () => {
    const user = userEvent.setup();
    vi.mocked(api.clubAnnouncements).mockResolvedValue({ canWrite: true, wholeClub: true, squads: [{ id: 10, name: 'U12' }], announcements: [announcement({ told: 12, canEnd: true })] });
    vi.mocked(api.announceToClub).mockResolvedValue({ id: 5, told: 40 });
    render(<ClubAnnouncementsBox clubId={1} />);
    expect(await screen.findByText('Pitch closed Saturday')).toBeInTheDocument();
    expect(screen.getByText('Sent to 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Announce' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Whole club' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(within(dialog).getByLabelText('Title'), 'Fees due Friday');
    await user.click(within(dialog).getByRole('button', { name: /Send and pin/ }));
    expect(api.announceToClub).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Fees due Friday', squadIds: [], requestId: expect.any(String) }));
    const days = (Date.parse(vi.mocked(api.announceToClub).mock.calls[0][1].expiresAt) - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(7); expect(days).toBeLessThan(8.1);
    expect(await within(dialog).findByText(/Sent to 40 people/)).toBeInTheDocument();
});

it('shows a family the pinned announcement without the writer’s tools, and nothing when none is pinned', async () => {
    vi.mocked(api.clubAnnouncements).mockResolvedValue({ canWrite: false, wholeClub: false, squads: [], announcements: [announcement()] });
    const { unmount } = render(<ClubAnnouncementsBox clubId={1} />);
    expect(await screen.findByText(/Pinned until/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Announce' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unpin' })).not.toBeInTheDocument();
    unmount();
    vi.mocked(api.clubAnnouncements).mockResolvedValue({ canWrite: false, wholeClub: false, squads: [], announcements: [] });
    const { container } = render(<ClubAnnouncementsBox clubId={1} />);
    await waitFor(() => expect(api.clubAnnouncements).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
});

it('pins in Parent Hub what is for the child’s club or squads only', async () => {
    vi.mocked(api.myClubAnnouncements).mockResolvedValue([
        announcement({ id: 1, title: 'Whole club news' }),
        announcement({ id: 2, title: 'For U12', squadIds: [10], squadNames: ['U12'] }),
        announcement({ id: 3, title: 'For U9', squadIds: [11], squadNames: ['U9'] }),
        announcement({ id: 4, title: 'Another club', clubId: 2 }),
    ]);
    render(<ClubPinned squads={[{ id: 10, club_id: 1 }]} />);
    expect(await screen.findByText('Whole club news')).toBeInTheDocument();
    expect(screen.getByText('For U12')).toBeInTheDocument();
    expect(screen.queryByText('For U9')).not.toBeInTheDocument();
    expect(screen.queryByText('Another club')).not.toBeInTheDocument();
});
