/** Local visual QA only. Every request resolves from this in-memory adapter. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../../api/axiosConfig';
import i18n from '../../../../i18n';
import { OrganizationProfilePreview } from '../../../../pages/OrganizationProfilePage';
import type { OrganizationProfile } from '../../domain';
import type { OrganizationCapabilities } from '../../activities/api';
import '../../../../index.css';
import '../../../../styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Local development fixture only');

const params = new URLSearchParams(location.search);
const scenario = params.get('case') || 'mixed';
const language = params.get('lang') === 'ka' ? 'ka' : 'en';
const dark = params.get('theme') === 'dark';
const settings = params.get('settings') === '1';
const clean = params.get('clean') === '1';
document.documentElement.classList.toggle('dark', dark);
document.documentElement.lang = language;
await i18n.changeLanguage(language);

const capability = (overrides: Partial<OrganizationCapabilities> = {}): OrganizationCapabilities => ({ enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 3, venueAvailable: true,
    canConfigureActivities: false, canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canCreateTournament: true, canInviteVenueOperator: false, ...overrides });
const profile = (overrides: Partial<OrganizationProfile> = {}): OrganizationProfile => ({ id: 17, displayName: language === 'ka' ? 'სათემო ფეხბურთის ცენტრი' : 'Community Football Centre', kinds: ['VENUE'], profileKind: 'VENUE', clubId: null,
    verificationStatus: 'UNVERIFIED', published: false, website: 'https://example.test/football', publicEmail: 'hello@example.test', publicPhone: '+995 555 010 101', addressText: language === 'ka' ? 'თბილისი · სპორტული ქუჩა 12' : 'Tbilisi · Sport Street 12',
    description: language === 'ka' ? 'ღია სივრცე ვარჯიშისა და თამაშისთვის.' : 'A practical home for local training and matches.', focus: language === 'ka' ? 'გუნდები, ვარჯიში და ტურნირები' : 'Teams, training and tournaments', canEdit: true, canCreateTournament: true, capabilities: capability(), ...overrides });
const selected: Record<string, OrganizationProfile> = {
    mixed: profile(),
    tournament: profile({ displayName: language === 'ka' ? 'საბავშვო ლიგა' : 'Junior League', profileKind: 'TOURNAMENT_ORGANIZER', kinds: ['TOURNAMENT_ORGANIZER'], capabilities: capability({ enabledActivities: ['PROFILE', 'TOURNAMENT'], venueAvailable: false, canManageVenueBookings: false, canConfigureVenue: false }), }),
    readonly: profile({ displayName: language === 'ka' ? 'სათემო გუნდი' : 'Community Team', profileKind: 'MEDIA', kinds: ['MEDIA'], canEdit: false, canCreateTournament: false, capabilities: capability({ enabledActivities: ['PROFILE'], venueAvailable: false, canConfigureVenue: false, canManageVenueBookings: false, canCreateTournament: false, canEditProfile: false }), }),
    blocked: profile({ promotionBlocked: true, canEdit: false, description: 'REDACTED fixture description', focus: 'REDACTED fixture focus', addressText: 'REDACTED fixture address', publicEmail: 'redacted@example.test', publicPhone: '+995 555 999 999', website: 'https://redacted.example.test' }),
    club: profile({ displayName: language === 'ka' ? 'რივერსაიდის აკადემია' : 'Riverside Academy', profileKind: 'CLUB', kinds: ['CLUB'], clubId: 44, canEdit: false, capabilities: capability({ canManageVenueBookings: true, canEditProfile: false, canConfigureActivities: true, canInviteVenueOperator: false }), }),
};
let current = selected[scenario] ?? selected.mixed;
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
const response = (data: unknown, config: InternalAxiosRequestConfig) => ({ data: structuredClone(data), status: 200, statusText: 'Synthetic', headers: {}, config });
apiClient.defaults.adapter = async config => {
    const path = config.url ?? '', method = config.method;
    if (scenario === 'loading') return new Promise<never>(() => {});
    if (scenario === 'error') throw new Error('Synthetic profile request failure');
    if (path === '/organizations/17/presentation') return response({ profile: current, branding: { revision: 0 }, portfolio: { venues: [] }, competitions: [], canOpenWorkspace: true, membershipRole: 'OWNER' }, config);
    if (path === '/organizations/17' && method === 'get') return response(current, config);
    if (path === '/organizations/17' && method === 'put') { current = { ...current, ...(JSON.parse(config.data as string) as Partial<OrganizationProfile>) }; return response(current, config); }
    throw new Error(`Fixture does not implement ${method} ${path}. No request was sent.`);
};
const query = (next: { scenario?: string; theme?: string; lang?: string; settings?: boolean }) => {
    const value = new URLSearchParams({ case: next.scenario ?? scenario, theme: next.theme ?? (dark ? 'dark' : 'light'), lang: next.lang ?? language });
    if (next.settings ?? settings) value.set('settings', '1');
    return `?${value.toString()}`;
};
createRoot(document.getElementById('root')!).render(<>
    {!clean && <header style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--app-border-strong)', color: 'var(--app-text-primary)', fontSize: 12 }}><strong>LOCAL ORGANIZATION FIXTURE · SYNTHETIC DATA</strong><nav aria-label="Fixture states" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{['mixed', 'tournament', 'readonly', 'blocked', 'club', 'error', 'loading'].map(value => <a key={value} href={query({ scenario: value })}>{value}</a>)}<a href={query({ theme: dark ? 'light' : 'dark' })}>{dark ? 'light' : 'dark'}</a><a href={query({ lang: language === 'en' ? 'ka' : 'en' })}>{language === 'en' ? 'ქართული' : 'English'}</a>{scenario === 'club' && <a href={query({ settings: !settings })}>{settings ? 'club profile' : 'settings'}</a>}</nav></header>}
    <MemoryRouter initialEntries={[`/organizations/17${settings ? '?settings=1' : ''}`]}><OrganizationProfilePreview /></MemoryRouter>
</>);
