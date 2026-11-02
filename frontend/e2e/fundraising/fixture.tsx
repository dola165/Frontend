// Synthetic UI contract fixture, not a backend/provider verification or production route.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import { apiClient } from '../../src/api/axiosConfig';
import { StartFundraiser, PersonalFundraising } from '../../src/features/campaigns/PersonalFundraising';
import { FundraiserPage } from '../../src/pages/FundraiserPage';
import type { Campaign, CampaignInput } from '../../src/features/campaigns/api';
import { FixtureAuth } from './auth';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';

const params = new URLSearchParams(location.search);
void i18n.changeLanguage('en');
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
localStorage.setItem('gk-session-id', 'fundraising-fixture');
localStorage.setItem('userId', '10');
const now = '2026-10-30T10:00:00Z';
let record: Campaign = { id: 7, clubId: null, clubName: '', title: params.has('long') ? 'A long but specific adult appeal for replacement training kit and transport to weekly grassroots football sessions' : 'Boots for my season', summary: 'Adult kit support', description: 'My boots have worn out. I am raising funds for replacement boots to continue the season.', beneficiary: 'Synthetic adult', useOfFunds: 'One pair of football boots', category: 'EQUIPMENT', currency: 'GEL', goalAmount: 200, reportedAmount: null, reportedAt: null, reportedNote: '', startsOn: null, endsOn: null, images: [], status: 'DRAFT', phase: 'DRAFT', version: 0, updatedAt: now, publishedAt: null, updates: [], history: [], publisher: { kind: 'PERSON', name: 'Synthetic adult', userId: 10, profilePath: '/profile/10' } };
const receipts = new Map<string, Campaign>();
let failed = false;
const snapshot = () => JSON.parse(JSON.stringify(record)) as Campaign;
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
    const path = config.url ?? '', method = config.method?.toUpperCase();
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const request = String(config.headers?.get('X-Request-Id'));
    const deny = () => { throw new AxiosError('Unavailable', 'ERR_BAD_REQUEST', config, undefined, { status: 404, data: { detail: 'Appeal unavailable' } } as AxiosResponse); };
    let data: unknown;
    if (path === '/fundraising/clubs') data = [{ id: 11, name: 'FC Dinamo Tbilisi Academy (synthetic)' }];
    else if (path === '/fundraising/mine' && method === 'GET') data = params.has('empty') ? [] : [snapshot()];
    else if (path === '/fundraising/mine/7' && method === 'GET') {
        if (params.has('error') && !failed) { failed = true; throw new Error('Synthetic temporary outage'); }
        data = snapshot();
    } else if ((path === '/fundraising/mine' || path === '/fundraising/mine/7') && method !== 'GET') {
        if (receipts.has(request)) data = receipts.get(request);
        else { record = { ...record, ...body as CampaignInput, beneficiary: 'Synthetic adult', version: record.version + 1 }; data = snapshot(); receipts.set(request, data as Campaign); }
    } else if (path === '/fundraising/mine/7/state') {
        if (!receipts.has(request)) {
            record.status = body.status; record.phase = body.status === 'PUBLISHED' ? 'ACTIVE' : body.status;
            record.version++; if (body.status === 'PUBLISHED') record.publishedAt = now;
            receipts.set(request, snapshot());
        }
        data = receipts.get(request);
    } else if (path === '/fundraising/mine/7/updates') {
        record.updates.push({ id: 1, title: body.title, body: body.body, createdAt: now }); record.version++; data = snapshot();
    } else if (path === '/campaigns/7') {
        if (record.status === 'DRAFT' || record.status === 'ARCHIVED') deny();
        data = snapshot();
    } else if (path === '/projects/fundraisers/7') deny();
    else deny();
    return { data, status: 200, statusText: 'OK', headers: {}, config };
};
const entry = params.get('view') === 'new' ? '/campaigns/new?for=me' : params.has('empty') ? '/campaigns?mine=all' : '/campaigns?mine=7';
createRoot(document.getElementById('root')!).render(<FixtureAuth.Provider value={{ user: { id: 10, fullName: 'Synthetic adult' }, sessionId: 'fundraising-fixture' }}><MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/campaigns" element={<PersonalFundraising />} /><Route path="/campaigns/new" element={<StartFundraiser />} /><Route path="/campaigns/:id" element={<FundraiserPage />} />
    <Route path="*" element={<p>Fixture destination</p>} />
</Routes></MemoryRouter></FixtureAuth.Provider>);
