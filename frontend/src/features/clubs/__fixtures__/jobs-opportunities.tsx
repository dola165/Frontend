/** Local visual QA only. Every request is resolved from deterministic in-memory data. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../api/axiosConfig';
import i18n from '../../../i18n';
import { JobDetailPage } from '../../../pages/JobDetailPage';
import { JobsDirectoryPage } from '../../../pages/JobsDirectoryPage';
import type { ClubJob, MyJobApplication } from '../api';
import '../../../index.css';
import '../../../styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    throw new Error('Local development fixture only');
}

const params = new URLSearchParams(location.search);
const scenario = params.get('case') || 'populated';
const surface = params.get('surface') === 'detail' ? 'detail' : 'directory';
const language = params.get('lang') === 'ka' ? 'ka' : 'en';
const dark = params.get('theme') === 'dark';
const clean = params.get('clean') === '1';
const anonymous = params.get('auth') === 'anonymous';

document.documentElement.classList.toggle('dark', dark);
document.documentElement.lang = language;
await i18n.changeLanguage(language);

const now = Date.now();
const roles: ClubJob[] = [
    {
        id: 11, clubId: 7, title: 'U17 goalkeeper coach',
        description: 'Lead two focused goalkeeper sessions each week and support U17 match preparation.',
        ageGroup: 'U17', level: 'ADVANCED', requiredRole: 'COACH', status: 'OPEN', category: 'COACHING', engagementType: 'PAID',
        clubName: 'Riverside Football Academy', clubCityName: 'Tbilisi', clubCountryName: 'Georgia', clubLogoUrl: null,
        createdAt: new Date(now - 2 * 86_400_000).toISOString(),
    },
    {
        id: 12, clubId: 9, title: 'Academy operations coordinator',
        description: 'Coordinate training logistics, team travel notes and weekly academy schedules with coaching staff.',
        level: 'ANY', requiredRole: null, status: 'OPEN', category: 'FOOTBALL_OPERATIONS', engagementType: 'FLEXIBLE',
        clubName: 'Old Town FC', clubCityName: 'Kutaisi', clubCountryName: 'Georgia', clubLogoUrl: null,
        createdAt: new Date(now - 4 * 86_400_000).toISOString(),
    },
    {
        id: 13, clubId: 14, title: 'Community football coordinator',
        description: 'Support an ongoing weekly community programme and welcome new families to the club.',
        requiredRole: null, status: 'OPEN', category: 'OTHER', engagementType: 'VOLUNTEER',
        clubName: 'Batumi Community Club', clubCityName: 'Batumi', clubCountryName: 'Georgia', clubLogoUrl: null,
        createdAt: new Date(now - 8 * 86_400_000).toISOString(),
    },
    {
        id: 14, clubId: 17, title: 'Matchday physiotherapist',
        description: 'Provide first-response support for senior home fixtures and coordinate follow-up with club staff.',
        level: 'QUALIFIED', requiredRole: null, status: 'OPEN', category: 'MEDICAL', engagementType: 'PAID',
        clubName: 'Rustavi United', clubCityName: 'Rustavi', clubCountryName: 'Georgia', clubLogoUrl: null,
        createdAt: new Date(now - 12 * 86_400_000).toISOString(),
    },
];

const detailRole = scenario === 'contact'
    ? { ...roles[1], title: 'Matchday operations coordinator', category: 'MATCHDAY' as const, requiredRole: 'CLUB_ADMIN' }
    : roles[0];
const application: MyJobApplication | null = scenario === 'pending'
    ? { id: 71, clubId: detailRole.clubId!, status: 'PENDING' }
    : scenario === 'accepted'
        ? { id: 71, clubId: detailRole.clubId!, status: 'ACCEPTED' }
        : null;

apiClient.interceptors.request.clear();
apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
    const path = config.url || '';
    if (config.method === 'get' && path === '/jobs') {
        if (scenario === 'error') throw new Error('Synthetic directory failure');
        if (scenario === 'loading') return new Promise<never>(() => {});
        return response(scenario === 'empty' ? [] : roles, config);
    }
    if (config.method === 'get' && path === `/jobs/${detailRole.id}`) {
        if (scenario === 'error') throw new Error('Synthetic detail failure');
        if (scenario === 'loading') return new Promise<never>(() => {});
        return response(detailRole, config);
    }
    if (config.method === 'get' && path === `/jobs/${detailRole.id}/application`) {
        return response(application, config);
    }
    throw new Error(`Synthetic jobs preview does not implement ${config.method} ${path}. No request was sent.`);
};

function response(data: unknown, config: InternalAxiosRequestConfig) {
    return { data: structuredClone(data), status: 200, statusText: 'Synthetic', headers: {}, config };
}

const query = (next: Record<string, string>) => {
    const value = new URLSearchParams({
        case: scenario,
        surface,
        lang: language,
        theme: dark ? 'dark' : 'light',
        auth: anonymous ? 'anonymous' : 'authenticated',
        ...next,
    });
    return `?${value.toString()}`;
};

const startPath = surface === 'detail' ? `/jobs/${detailRole.id}` : '/jobs';

createRoot(document.getElementById('root')!).render(
    <>
        {!clean && <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--app-border-strong)', background: 'var(--app-shell-surface)', color: 'var(--app-text-primary)', fontSize: 13 }}>
            <strong>LOCAL JOBS FIXTURE · SYNTHETIC DATA · NO SERVICE WRITES</strong>
            <nav aria-label="Fixture states" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {['populated', 'empty', 'error', 'loading', 'demo', 'pending', 'accepted', 'contact'].map(value => <a key={value} href={query({ case: value, surface: ['pending', 'accepted', 'contact'].includes(value) ? 'detail' : surface })}>{value}</a>)}
                <a href={query({ surface: surface === 'detail' ? 'directory' : 'detail' })}>{surface === 'detail' ? 'directory' : 'detail'}</a>
                <a href={query({ theme: dark ? 'light' : 'dark' })}>{dark ? 'light' : 'dark'}</a>
                <a href={query({ lang: language === 'en' ? 'ka' : 'en' })}>{language === 'en' ? 'ქართული' : 'English'}</a>
                <a href={query({ auth: anonymous ? 'authenticated' : 'anonymous', surface: 'detail' })}>{anonymous ? 'authenticated' : 'anonymous'}</a>
            </nav>
        </header>}
        <MemoryRouter initialEntries={[startPath]}>
            <Routes>
                <Route path="/jobs" element={<JobsDirectoryPage previewMockMode={scenario === 'demo'} />} />
                <Route path="/jobs/:id" element={<JobDetailPage previewAuth={{ status: anonymous ? 'anonymous' : 'authenticated', user: anonymous ? null : { id: 55 } }} />} />
                <Route path="*" element={<main className="store-page jobs-page"><p>This destination is outside the isolated fixture.</p></main>} />
            </Routes>
        </MemoryRouter>
    </>,
);
