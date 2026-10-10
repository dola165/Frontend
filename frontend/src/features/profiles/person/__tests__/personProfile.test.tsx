import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PersonProfile, Profession } from '../../api';
import { PersonLayers } from '../PersonLayers';
import { PersonSide } from '../PersonSide';
import { personTabFrom, personTabs } from '../personTabs';
import type { PersonView } from '../usePersonProfile';
import { calendarDestination } from '../../../schedule/personal/calendarDestination';

vi.mock('../../../agents/RepresentationPanel', () => ({ RepresentationPanel: () => null }));
vi.mock('../../../agents/ClubApproachesPanel', () => ({ ClubApproachesPanel: () => null }));
vi.mock('../../../../api/axiosConfig', () => ({ DEPLOYMENT_URLS: { mediaBaseUrl: 'http://localhost:8080' }, apiClient: { get: vi.fn(async () => ({ data: [] })) } }));

const player: PersonProfile = {
    id: 30, username: 'saba', fullName: 'Saba Lomidze', role: 'PLAYER', position: 'Striker', preferredFoot: 'Left', heightCm: 171, weightKg: 60,
    followerCount: 2, followingCount: 3, isFollowedByMe: false, dateOfBirth: null,
    roleProfiles: [{ role: 'PLAYER', primary: true, published: true, headline: 'Striker', qualifications: 'Regional camp' }],
    footballProfile: { roles: ['PLAYER'], entries: [], appointments: [{ clubId: 1, clubName: 'Dinamo Academy', logoUrl: null, role: 'PLAYER', title: 'Player · #17', coaching: false, memberSince: '2018-01-01', biography: null, qualifications: null, squads: ['U16 Boys'] }] },
};
const professions: Profession[] = [
    { id: 1, title: 'Photographer', label: 'Photography', detail: null, since: '2019', published: true, verification: 'SELF_REPORTED', verifiedBy: null },
    { id: 2, title: 'Sports psychologist', label: 'Sports psychology', detail: null, since: '2015', published: true, verification: 'CLUB_CONFIRMED', verifiedBy: 'Dinamo Academy' },
];
const view = (overrides: Partial<PersonView>) => ({ profile: player, own: false, roles: ['PLAYER'], hidden: false, possibleMinor: true, professions, professionsFailed: false, ...overrides }) as PersonView;

describe('person profile', () => {
    it('keeps roles, professions and club confirmation apart and never presents self-reported facts as verified', () => {
        render(<MemoryRouter><PersonLayers profile={player} roles={['PLAYER']} professions={professions} professionsFailed={false} own={false} /></MemoryRouter>);
        expect(screen.getByText(/Qualifications \(self-reported\): Regional camp/)).toBeInTheDocument();
        const work = within(screen.getByRole('list', { name: 'Professions and skills' }));
        expect(work.getByText('Self-reported')).toBeInTheDocument();
        expect(work.getByText('Confirmed by Dinamo Academy')).toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: 'Club appointments' })).getByText('Recorded by the club')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Change roles' })).not.toBeInTheDocument();
    });

    it('keeps a possible minor’s body measurements off other people’s view', () => {
        render(<MemoryRouter><PersonSide view={view({})} /></MemoryRouter>);
        expect(screen.getByText('Striker')).toBeInTheDocument();
        expect(screen.queryByText('171 cm')).not.toBeInTheDocument();
        expect(screen.queryByText('60 kg')).not.toBeInTheDocument();
    });

    it('offers the schedule only on your own profile and only the overview of a private profile', () => {
        expect(personTabs({ own: true, hidden: false, career: true }).map(tab => tab.id)).toEqual(['overview', 'posts', 'career', 'media', 'schedule']);
        expect(personTabs({ own: false, hidden: false, career: false }).map(tab => tab.id)).toEqual(['overview', 'posts', 'media']);
        expect(personTabs({ own: false, hidden: true, career: true }).map(tab => tab.id)).toEqual(['overview']);
        const others = personTabs({ own: false, hidden: false, career: true });
        expect(personTabFrom('schedule', others)).toBe('overview');
        expect(personTabFrom('stats', others)).toBe('career');
        expect(personTabFrom('videos', others)).toBe('media');
    });

    it('sends every old calendar link to the schedule that now owns it', () => {
        expect(calendarDestination('')).toBe('/profile/me?tab=schedule');
        expect(calendarDestination('?eventId=355&date=2026-10-12')).toBe('/profile/me?tab=schedule&eventId=355&date=2026-10-12');
        expect(calendarDestination('?scope=squad&squadId=105&sessionId=9')).toBe('/squads/105?tab=sessions&sessionId=9');
        expect(calendarDestination('?clubId=1')).toBe('/clubs/1/workspace?tab=calendar');
        expect(calendarDestination('?scope=personal')).toBe('/profile/me?tab=schedule');
        expect(calendarDestination('?scope=squad')).toBe('/my-squads?tab=calendar');
    });
});
