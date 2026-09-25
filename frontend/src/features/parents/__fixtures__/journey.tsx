/** Local visual QA only. Every request is resolved by this in-memory adapter. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { getAuthSessionId } from '../../../utils/authStorage';
import type { ParentHub } from '../api';
import type { SquadOverview, SquadSession, SquadSpace } from '../../squadCommunication/api';
import '../../../index.css';
import '../../../styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    throw new Error('Local development fixture only');
}

const params = new URLSearchParams(location.search);
const scenario = params.get('case') || 'family';
const language = params.get('lang') === 'ka' ? 'ka' : 'en';
const dark = params.get('theme') === 'dark';
const clean = params.get('clean') === '1';
document.documentElement.classList.toggle('dark', dark);
document.documentElement.lang = language;

await i18n.changeLanguage(language);

const tomorrow = new Date(Date.now() + 30 * 60_000);
const ends = new Date(tomorrow.getTime() + 90 * 60_000);
const nextMatch = new Date(tomorrow.getTime() + 3 * 86_400_000);
const nextMatchEnd = new Date(nextMatch.getTime() + 90 * 60_000);

const hub: ParentHub = {
    scheduleFrom: new Date().toISOString(),
    scheduleTo: new Date(Date.now() + 31 * 86_400_000).toISOString(),
    children: [
        {
            cardId: 501, userId: 61, fullName: 'Nika · ნიკა', birthYear: 2012, photoUrl: null,
            position: 'GOALKEEPER', registered: true, activationEligible: false,
            clubId: 1, clubName: 'Riverside Academy', squadNames: ['U15'], affiliationStatus: 'ACTIVE',
            consentStatus: 'CONFIRMED', trialEndsOn: null, publicEvents: [],
        },
        {
            cardId: 502, userId: 62, fullName: 'Saba · საბა', birthYear: 2014, photoUrl: null,
            position: null, registered: false, activationEligible: false,
            clubId: 2, clubName: 'Metro Football School', squadNames: ['U13'], affiliationStatus: 'TRIALIST',
            consentStatus: 'PENDING', trialEndsOn: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), publicEvents: [],
        },
    ],
};

const spaces: SquadSpace[] = [
    { id: 11, club_id: 1, academy_name: 'Riverside Academy', name: 'U15', category: 'U15', can_manage: false, unread_count: 1 },
    { id: 22, club_id: 2, academy_name: 'Metro Football School', name: 'U13', category: 'U13', can_manage: false, unread_count: 0 },
];
const overview = (space: SquadSpace): SquadOverview => ({
    ...space, viewer_id: 31, member_count: 16, notify_chat: true, head_coach_id: space.id === 11 ? 21 : 25,
    can_assign_coach: false, available_coaches: [], coaches: [{ user_id: space.id === 11 ? 21 : 25, full_name: space.id === 11 ? 'Coach Maia' : 'Coach Giorgi' }],
    players: [{ id: space.id === 11 ? 61 : 62, name: space.id === 11 ? 'Nika' : 'Saba' }], threads: [],
});
const sessions: Record<number, SquadSession[]> = {
    11: [
        {
            id: 91, title: 'Passing practice · პასების ვარჯიში', starts_at: tomorrow.toISOString(), ends_at: ends.toISOString(),
            location: 'Academy pitch A', status: 'SCHEDULED', cancellation_reason: null, revision: 3, response_revision: 3,
            response_kind: 'INTENT', attendance: [{ id: 61, name: 'Nika', response: 'RECONFIRMATION_REQUIRED', previous_response: 'GOING', response_status: 'RECONFIRMATION_REQUIRED', active: true, recorded_by: 'GUARDIAN' }],
        },
        {
            id: 92, title: 'League match · ლიგის მატჩი', starts_at: nextMatch.toISOString(), ends_at: nextMatchEnd.toISOString(),
            location: 'Riverside stadium', status: 'SCHEDULED', cancellation_reason: null, revision: 1, response_revision: 1,
            response_kind: 'INTENT', attendance: [{ id: 61, name: 'Nika', response: 'GOING', previous_response: 'GOING', response_status: 'VALID', active: true, recorded_by: 'GUARDIAN' }],
        },
    ],
    22: [],
};

apiClient.interceptors.request.clear();
apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
    const path = config.url || '';
    if (config.method === 'get' && path === '/parents/hub') {
        if (scenario === 'error') throw new Error('Synthetic connection failure');
        if (scenario === 'loading') return new Promise<never>(() => {});
        return response(scenario === 'empty' ? { ...hub, children: [] } : hub, config);
    }
    if (config.method === 'get' && path === '/squad-communication') return response(spaces, config);
    const overviewMatch = path.match(/^\/squad-communication\/(11|22)$/);
    if (config.method === 'get' && overviewMatch) {
        const space = spaces.find(item => item.id === Number(overviewMatch[1]))!;
        return response(overview(space), config);
    }
    const sessionsMatch = path.match(/^\/squad-communication\/(11|22)\/sessions$/);
    if (config.method === 'get' && sessionsMatch) return response(sessions[Number(sessionsMatch[1])] ?? [], config);
    if (config.method === 'get' && /^\/schedule\/clubs\/\d+\/events$/.test(path)) return response({ events: [] }, config);
    if (config.method === 'put' && /\/sessions\/\d+\/attendance$/.test(path)) return response({ saved: true }, config);
    throw new Error(`Synthetic preview does not implement ${config.method} ${path}. No request was sent.`);
};

function response(data: unknown, config: InternalAxiosRequestConfig) {
    return { data: structuredClone(data), status: 200, statusText: 'Synthetic', headers: {}, config };
}

const query = (next: { scenario?: string; theme?: string; lang?: string }) => {
    const value = new URLSearchParams({ case: next.scenario ?? scenario, theme: next.theme ?? (dark ? 'dark' : 'light'), lang: next.lang ?? language });
    return `?${value.toString()}`;
};

createRoot(document.getElementById('root')!).render(
    <>
        {!clean && <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--app-border-strong)', background: 'var(--app-shell-surface)', color: 'var(--app-text-primary)', fontSize: 13 }}>
            <strong>LOCAL PARENT FIXTURE · NO SERVICE WRITES</strong>
            <nav aria-label="Fixture states" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {['family', 'empty', 'error', 'loading'].map(value => <a key={value} href={query({ scenario: value })}>{value}</a>)}
                <a href={query({ theme: dark ? 'light' : 'dark' })}>{dark ? 'light' : 'dark'}</a>
                <a href={query({ lang: language === 'en' ? 'ka' : 'en' })}>{language === 'en' ? 'ქართული' : 'English'}</a>
            </nav>
        </header>}
        <MemoryRouter initialEntries={['/parent']}>
            <Routes>
                <Route path="/parent" element={<ParentHubPage previewSessionId={getAuthSessionId()} />} />
                <Route path="*" element={<main className="parent-hub"><p>This destination is outside the isolated fixture.</p></main>} />
            </Routes>
        </MemoryRouter>
    </>,
);
