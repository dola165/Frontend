/** Local visual QA. All activity requests use isolated in-memory records; no authentication/session writes. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../../api/axiosConfig';
import i18n from '../../../../i18n';
import { ActivitySettings } from '../OrganizationActivitySettings';
import { DelegationPanel, Invitations } from '../OrganizationDelegationPanel';
import type { OrganizationCapabilities, OrganizationInvitation, Delegation } from '../api';
import '../../../../index.css';
import '../../../../styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Local development fixture only');
const params = new URLSearchParams(location.search), scenario = params.get('case') || 'populated';
const language = params.get('lang') === 'ka' ? 'ka' : 'en', dark = params.get('theme') === 'dark', inbox = params.get('surface') === 'invitations';
document.documentElement.lang = language; document.documentElement.classList.toggle('dark', dark);
await i18n.changeLanguage(language);
let caps: OrganizationCapabilities = { enabledActivities: ['PROFILE', 'VENUE', 'TOURNAMENT'], revision: 4, venueAvailable: true,
    canConfigureActivities: true, canEditProfile: true, canConfigureVenue: true, canManageVenueBookings: true, canCreateTournament: true, canInviteVenueOperator: true };
const invitations: OrganizationInvitation[] = scenario === 'empty' ? [] : [{ id: 8, organizationId: 17, organizationName: language === 'ka' ? 'სათემო სპორტული მოედნები' : 'Community football grounds', recipientName: 'Nino · ნინო', status: 'PENDING', expiresAt: null, canRespond: true, canOpenVenue: false }];
const data: Delegation = { invitations, operators: scenario === 'empty' ? [] : [{ membershipId: 12, userId: 23, name: 'Luka · ლუკა', status: 'ACTIVE', startedAt: '2026-09-20T09:00:00', endedAt: null }] };
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
const response = (value: unknown, config: InternalAxiosRequestConfig) => ({ data: structuredClone(value), status: 200, statusText: 'Synthetic', headers: {}, config });
apiClient.defaults.adapter = async config => {
    const path = config.url ?? '', method = config.method;
    if (scenario === 'loading') return new Promise<never>(() => {});
    if (scenario === 'error') throw { response: { status: 503 } };
    if (scenario === 'conflict' && method !== 'get') throw { response: { status: 409 } };
    if (path === '/organizations/17/activities' && method === 'get') return response(caps, config);
    if (path === '/organizations/17/activities' && method === 'put') {
        const value = JSON.parse(config.data as string) as { venueEnabled: boolean; tournamentEnabled: boolean };
        caps = { ...caps, revision: caps.revision + 1, enabledActivities: ['PROFILE', ...(value.venueEnabled ? ['VENUE' as const] : []), ...(value.tournamentEnabled ? ['TOURNAMENT' as const] : [])] };
        return response(caps, config);
    }
    if (path === '/organizations/17/venue-operators' && method === 'get') return response(data, config);
    if (path === '/organizations/invitations/mine' && method === 'get') return response(invitations, config);
    if (path === '/organizations/invitations/8/response' && method === 'post') {
        const accepted = JSON.parse(config.data as string).action === 'ACCEPT';
        invitations[0] = { ...invitations[0], status: accepted ? 'ACCEPTED' : 'DECLINED', canRespond: false, canOpenVenue: accepted };
        return response(null, config);
    }
    if (path === '/organizations/17/venue-operators/12/revoke' && method === 'post') {
        data.operators[0].status = 'ENDED'; data.operators[0].endedAt = '2026-09-20T12:00:00'; return response(data, config);
    }
    if (path === '/organizations/17/venue-operators/invitations/8/cancel' && method === 'post') {
        invitations[0].status = 'CANCELLED'; return response(data, config);
    }
    if (path === '/organizations/17/venue-operators/invitations' && method === 'post') {
        data.invitations.push({ ...invitations[0], id: 30, organizationId: 17, organizationName: 'Community football grounds', recipientName: 'Invited operator', status: 'PENDING', canRespond: false, canOpenVenue: false, expiresAt: null });
        return response(data, config);
    }
    throw new Error(`Fixture does not implement ${method} ${path}. No request was sent.`);
};
createRoot(document.getElementById('root')!).render(<MemoryRouter><main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', color: 'var(--text-primary)' }}>
    <p style={{ fontSize: 12, marginBottom: 16 }}>{language === 'ka' ? 'ლოკალური ნიმუში · სინთეზური მონაცემები' : 'Local fixture · synthetic records'}</p>
    <h1 style={{ fontSize: 26, fontWeight: 650 }}>{language === 'ka' ? 'სათემო სპორტული მოედნები' : 'Community football grounds'}</h1>
    {inbox ? <Invitations /> : <><ActivitySettings id={17} /><DelegationPanel id={17} /></>}
</main></MemoryRouter>);
