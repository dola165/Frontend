// Local UI evidence only. The adapter below serves every API request in memory.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import i18n from '../../src/i18n';
import '../../src/index.css';
import { apiClient } from '../../src/api/axiosConfig';
import { TopNav } from '../../src/components/layout/TopNav';
import { ClubAccessEntry } from '../../src/components/layout/ClubSwitcher';
import { OrganizationProfilePage } from '../../src/pages/OrganizationProfilePage';
import { OrganizationWorkspacePage } from '../../src/pages/OrganizationWorkspacePage';
import { PreviewAuth, type PreviewUser } from './experience-auth';
import type { WorkspaceCapability } from '../../src/context/navigationCapabilities';
import type { ThemePreference } from '../../src/theme';

const context = (id: string, type: string, number: number, label: string): WorkspaceCapability => ({ id, context: { type, id: number, label } });
const personas: Record<string, WorkspaceCapability[]> = {
  coach: [context('club.workspace', 'club', 1, 'FC Dinamo Tbilisi Academy'), context('club.workspace', 'club', 121, 'Second club · fixture'), context('squad.workspace', 'squad', 11, 'Dinamo U16'), context('tournament.workspace', 'tournament', 31, 'Academy Cup')],
  guardian: [context('parent.hub', 'user', 1, 'Parent Hub')],
  venue: [context('venue.workspace', 'organization', 133, 'Tbilisi Football Park'), context('organization.workspace', 'organization', 133, 'Tbilisi Football Park')],
  sponsor: [context('organization.workspace', 'organization', 17, 'Community Football Partner')],
  referee: [context('referee.workspace', 'user', 1, 'Referee workspace'), context('agent.hub', 'user', 1, 'Agent Hub')],
  fresh: [], guest: [],
};
let persona = 'coach', failVenue = false, requestsForFailedVenue = 0;
const profile = (id: number) => ({ id, clubId: null, displayName: id === 133 ? 'Tbilisi Football Park' : 'Community Football Partner',
  profileKind: id === 133 ? 'VENUE' : 'SPONSOR', published: id === 133, description: id === 133 ? 'Football spaces for academy sessions, friendly matches and the local community.' : 'We support community football and help local teams organize inclusive competitions.',
  focus: id === 133 ? null : 'Grassroots partnerships and community events.', addressText: 'Tbilisi, Georgia', publicEmail: 'football@example.test', publicPhone: '+995555010101', website: 'https://example.test',
  canEdit: persona === 'sponsor' || persona === 'venue', canCreateTournament: persona === 'sponsor', verificationStatus: 'UNVERIFIED',
  capabilities: { enabledActivities: id === 133 ? ['PROFILE', 'VENUE'] : ['PROFILE', 'TOURNAMENT'], venueAvailable: id === 133 } });
const venue = (id: number) => ({ id, revision: 1, displayName: id === 133 ? 'Tbilisi Football Park' : 'Academy Training Ground', description: 'Isolated UI fixture', city: 'Tbilisi', addressText: 'Tbilisi', timezone: 'Asia/Tbilisi', currency: 'GEL', published: true, bookingMode: 'REQUEST',
  canManage: persona === 'venue' && id === 133, photos: [], amenities: [], openingHours: [], publicPhone: '', publicEmail: '', website: '', minBookingMinutes: 60, maxBookingMinutes: 180, slotMinutes: 30, cancellationHours: 24,
  pitches: [{ id: id * 10, revision: 1, name: 'Main training pitch', active: true, pricePerHour: 90, format: '7_A_SIDE', surface: 'ARTIFICIAL_GRASS', covered: false }],
  capabilities: { enabledActivities: ['PROFILE', 'VENUE'], canConfigureVenue: persona === 'venue' && id === 133 } });
apiClient.defaults.adapter = async config => {
  const path = config.url ?? '';
  if (!['get', 'put'].includes(config.method ?? 'get')) throw new Error('Only isolated profile edits are supported in this UI fixture.');
  let data: unknown = {};
  const organization = path.match(/^\/organizations\/(\d+)(\/presentation)?$/), ground = path.match(/^\/venues\/(\d+)$/);
  if (organization) {
    const id = Number(organization[1]);
    const value = config.method === 'put' ? { ...profile(id), ...JSON.parse(config.data) } : profile(id);
    data = organization[2] ? { profile: value, branding: { revision: 0 }, portfolio: { venues: id === 133 ? [{ id: 133 }, { id: 134 }] : [] }, competitions: [], canOpenWorkspace: persona === 'venue' || persona === 'sponsor', membershipRole: persona === 'venue' || persona === 'sponsor' ? 'OWNER' : '' } : value;
  } else if (/^\/organizations\/\d+\/workspace$/.test(path)) {
    const id = Number(path.split('/')[2]);
    data = { id, displayName: profile(id).displayName, organizationType: id === 133 ? 'COMPANY' : 'SPONSOR', clubId: null, membershipRole: 'OWNER', canManage: true, venueCount: id === 133 ? 2 : 0, tournaments: [], identityRevision: 0, team: [], capabilities: { ...profile(id).capabilities, canManageVenueBookings: id === 133, canCreateTournament: id !== 133, canConfigureActivities: true } };
  } else if (path.endsWith('/portfolio')) data = { venues: path.includes('/133/') ? [133, 134].map(id => ({ id, relationshipId: id + 1000, name: venue(id).displayName, city: 'Tbilisi', relationship: 'OPERATES', revision: 1, published: true, canManage: id === 133, canEnd: false })) : [], canManageRelationships: false };
  else if (path.endsWith('/team')) data = { members: [], invitations: [], canInvite: false };
  else if (path.endsWith('/activities')) data = { ...profile(Number(path.split('/')[2])).capabilities, canConfigureActivities: false };
  else if (ground) {
    if (failVenue && ground[1] === '134' && requestsForFailedVenue++ === 0) throw new AxiosError('Fixture venue temporarily unavailable', 'ERR_NETWORK', config);
    if (failVenue && ground[1] === '134') await new Promise(resolve => setTimeout(resolve, 1600));
    data = venue(Number(ground[1]));
  } else if (path.endsWith('/availability')) data = { venueId: 133, timezone: 'Asia/Tbilisi', days: [], fromDate: '2026-09-27', toDate: '2026-10-03' };
  else if (path === '/requests') data = { items: [], counts: { actionable: 0 }, unavailableSources: [], totalPages: 0 };
  else if (path.includes('notifications')) data = path.includes('count') ? 0 : { content: [], totalElements: 0 };
  else if (path.includes('branding')) data = { revision: 0 };
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

export function Review() {
  const [person, setPerson] = useState('coach'), [theme, setTheme] = useState<ThemePreference>('dark'), [language, setLanguage] = useState('en');
  const [failure, setFailure] = useState(false), [revision, setRevision] = useState(0);
  const navigate = useNavigate(), location = useLocation();
  const user: PreviewUser | null = person === 'guest' ? null : { id: 1, fullName: person === 'coach' ? 'Coach Luka' : `${person} · UI fixture`, username: person, role: 'FAN', navigationCapabilities: { version: 1, workspaces: personas[person] } };
  useEffect(() => { document.documentElement.classList.toggle('dark', theme !== 'light'); }, [theme]);
  return <PreviewAuth.Provider value={{ user, sessionId: `isolated-${person}-${revision}` }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 10, background: '#e2e8f0', color: '#0f172a', font: '12px system-ui' }} aria-label="Isolated review controls">
      <strong>Isolated UI fixtures</strong>
      <label>Context <select value={person} onChange={e => { persona = e.target.value; setPerson(e.target.value); navigate(e.target.value === 'sponsor' ? '/organizations/17' : e.target.value === 'venue' ? '/organizations/133?tab=venues' : e.target.value === 'guardian' ? '/parent' : e.target.value === 'referee' ? '/referees/me' : '/my-club'); }}>{Object.keys(personas).map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Language <select value={language} onChange={e => { setLanguage(e.target.value); void i18n.changeLanguage(e.target.value); }}><option>en</option><option>ka</option></select></label>
      <label>Preview page <select value={location.pathname.startsWith('/organizations/133') ? 'venues' : location.pathname.startsWith('/organizations/17') ? 'sponsor' : 'clubs'} onChange={e => navigate(e.target.value === 'venues' ? '/organizations/133?tab=venues' : e.target.value === 'sponsor' ? '/organizations/17' : '/my-club')}><option value="clubs">My clubs</option><option value="venues">Venue organization</option><option value="sponsor">Sponsor organization</option></select></label>
      <label><input type="checkbox" checked={failure} onChange={e => { failVenue = e.target.checked; setFailure(e.target.checked); requestsForFailedVenue = 0; setRevision(v => v + 1); }} />Fail one venue</label>
    </div>
    <div className="product-app-shell min-h-screen bg-[color:var(--theme-page)] text-[color:var(--text-primary)]">
      <TopNav key={person} user={user} myClubId={person === 'coach' ? 1 : null} themePreference={theme} setThemePreference={setTheme} handleLogout={() => {}} />
      <Routes>
        <Route path="/organizations/:organizationId" element={<OrganizationProfilePage />} />
        <Route path="/organizations/:organizationId/workspace" element={<OrganizationWorkspacePage />} />
        <Route path="/my-club" element={<ClubAccessEntry><Destination /></ClubAccessEntry>} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </div>
  </PreviewAuth.Provider>;
}
export function Destination() { const location = useLocation(); return <main style={{ padding: 28 }}><h1>Fixture destination</h1><p>{location.pathname}{location.search}</p><p>The production page is outside this component preview.</p></main>; }
void i18n.changeLanguage('en').then(() => createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/my-club']}><Review /></MemoryRouter>));
