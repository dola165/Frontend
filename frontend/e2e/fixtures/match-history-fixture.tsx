import { createRoot } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../src/api/axiosConfig';
import { MatchHistoryPage } from '../../src/pages/MatchHistoryPage';
import { MatchResultSection } from '../../src/features/matchExchange/MatchResultSection';
import type { Match, MatchResultState, ResultSuggestion } from '../../src/features/matchExchange/api';
import type { HistoryMatch } from '../../src/features/matchHistory/api';
import '../../src/index.css';
import '../../src/styles/product-identity.css';

if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) throw new Error('Local fixture only');
const params = new URLSearchParams(location.search), language = params.get('lang') === 'ka' ? 'ka' : 'en';
const staff = params.get('surface') === 'staff', detail = staff || params.get('surface') === 'viewer';
document.documentElement.classList.toggle('dark', params.get('theme') !== 'light');
const i18n = createInstance();
await i18n.init({ lng: language, fallbackLng: 'en', resources: { en: { translation: {} }, ka: { translation: {} } } });
const base: HistoryMatch = { id: 'event:12', sourceId: 12, source: 'MATCH_EXCHANGE', title: 'U16 autumn friendly', startsAt: '2026-09-20T12:00:00Z', endsAt: '2026-09-20T13:30:00Z', timezone: 'Asia/Tbilisi', homeClubId: 1, homeClubName: 'Tbilisi Football Academy', homeSquadName: 'Under 16', awayClubId: 2, awayClubName: 'Black Sea Juniors', awaySquadName: 'Under 16', homeScore: 2, awayScore: 1, resultStatus: 'CONFIRMED', fixtureStatus: 'COMPLETED', legacy: false, locationName: 'Central training ground', detailPath: '/match-exchange/12#result', canRecordResult: staff };
const records: HistoryMatch[] = [base, { ...base, id: 'event:13', sourceId: 13, title: 'Academy development match', homeScore: null, awayScore: null, resultStatus: 'NONE', startsAt: '2026-09-19T09:00:00Z' }, { ...base, id: 'event:14', sourceId: 14, title: 'Saturday league fixture', homeScore: 0, awayScore: 0, resultStatus: 'PROPOSED', startsAt: '2026-09-18T09:00:00Z' }, { ...base, id: 'event:15', sourceId: 15, title: 'Regional friendly', resultStatus: 'DISPUTED', startsAt: '2026-09-17T09:00:00Z' }, { ...base, id: 'event:16', sourceId: 16, title: 'Previous season', resultStatus: 'LEGACY', legacy: true, startsAt: '2025-09-15T09:00:00Z' }, { ...base, id: 'fixture:18', sourceId: 18, source: 'TOURNAMENT', title: 'Junior cup · quarter-final', resultStatus: 'RECORDED', tournamentName: 'Junior autumn cup', homeScore: 3, awayScore: 0, startsAt: '2026-09-16T09:00:00' }];
const match = { event_id: 12, club_name: base.homeClubName, squad_name: base.homeSquadName, opponent_name: base.awayClubName, home_score: null, away_score: null, result_status: null, event_status: 'COMPLETED', ends_at_iso: base.endsAt } as Match;
let result: MatchResultState = { eventId: 12, fixtureStatus: 'COMPLETED', status: 'NONE', revision: 3, homeScore: null, awayScore: null, proposalSide: null, requiredConfirmations: [], confirmations: [], legacy: false, authority: { roles: staff ? ['HOME'] : [], canPropose: staff, canCorrect: false, canDispute: false, confirmableRoles: [], correctableRoles: staff ? ['HOME'] : [] }, history: [] };
const rows: ResultSuggestion[] = staff ? [{ id: 8, homeScore: 2, awayScore: 1, note: 'The signed scorecard records a 2–1 home win.', evidenceUrl: 'https://example.org/scorecard', status: 'PENDING', revision: 1, createdAt: '2026-09-21T13:00:00Z', reviewedAt: null, adoptedResultRevision: null }] : [];
const envelope = () => ({ eventId: 12, resultRevision: result.revision, canSuggest: !staff && rows.length === 0, canReview: staff, reviewableRoles: staff ? ['HOME'] : [], adoptableRoles: staff && result.status !== 'PROPOSED' ? ['HOME'] : [], ownSuggestions: staff ? [] : rows, suggestions: staff ? rows.filter(row => row.status === 'PENDING') : [], reviewedSuggestions: staff ? rows.filter(row => row.status !== 'PENDING') : [], pendingCount: rows.filter(row => row.status === 'PENDING').length, page: 0, hasMore: false });
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
  const path = config.url ?? '', body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  let data: unknown;
  if (path === '/match-history/import/options') data = { clubs: params.has('import') ? [{ id: 1, name: 'Tbilisi Football Academy', squads: [{ id: 7, name: 'Under 16' }] }] : [] };
  else if (path === '/clubs') data = { content: [{ id: 2, name: 'Black Sea Juniors', city: 'Batumi' }], totalElements: 1 };
  else if (path === '/match-history/import') data = { eventId: 99, detailPath: '/calendar?eventId=99', resultStatus: 'RECORDED', historicalImport: true, homeScore: body.homeScore, awayScore: body.awayScore };
  else if (path.startsWith('/match-history?')) {
    const query = new URLSearchParams(path.split('?')[1]);
    let items = params.has('empty') ? [] : records.filter(row => query.get('period') !== 'NEEDS_RESULT' || ['NONE', 'PROPOSED', 'DISPUTED'].includes(row.resultStatus));
    if (query.get('period') === 'UPCOMING') items = [{ ...base, id: 'event:20', title: 'Next academy friendly', homeScore: null, awayScore: null, resultStatus: 'NONE', fixtureStatus: 'SCHEDULED', startsAt: '2026-10-01T12:00:00Z' }];
    if (query.get('resultStatus')) items = items.filter(row => row.resultStatus === query.get('resultStatus'));
    if (query.get('q')) items = items.filter(row => row.title.toLowerCase().includes(query.get('q')!.toLowerCase()));
    data = { items, total: items.length, page: 0, pageSize: 24 };
  } else if (path.endsWith('/result/summary')) data = { ...result, official: result.status === 'CONFIRMED', canReadAudit: staff };
  else if (path.endsWith('/result/suggestions') && config.method === 'get') data = envelope();
  else if (path.endsWith('/result/suggestions')) { rows.push({ id: 9, ...body, status: 'PENDING', revision: 1, createdAt: new Date().toISOString(), reviewedAt: null, adoptedResultRevision: null }); data = envelope(); }
  else if (path.endsWith('/review')) { rows[0].status = body.action === 'ADOPT' ? 'ADOPTED' : 'DISMISSED'; rows[0].reviewReason = body.reason; if (body.action === 'ADOPT') result = { ...result, revision: result.revision + 1, status: 'PROPOSED', homeScore: rows[0].homeScore, awayScore: rows[0].awayScore, proposalSide: 'HOME', requiredConfirmations: ['AWAY'], authority: { ...result.authority, canPropose: false, canCorrect: true, canDispute: true } }; data = envelope(); }
  else if (path.endsWith('/result') && config.method === 'get') data = result;
  else if (path.endsWith('/result')) { result = { ...result, homeScore: body.homeScore, awayScore: body.awayScore, status: 'PROPOSED', revision: result.revision + 1, proposalSide: 'HOME', requiredConfirmations: ['AWAY'] }; data = result; }
  else throw new Error(`Unsupported local fixture request: ${path}`);
  return { data: structuredClone(data), status: 200, statusText: 'OK', headers: {}, config };
};
const root = createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
root.render(<I18nextProvider i18n={i18n}><MemoryRouter initialEntries={[detail ? '/match-exchange/12' : '/match-history']}><Routes><Route path="/match-history" element={<MatchHistoryPage />} /><Route path="/match-exchange/12" element={<main className="mx-page" style={{ maxWidth: 800 }}><header className="mh-hero"><div><span className="mx-eyebrow">LOCAL REVIEW FIXTURE</span><h1>U16 autumn friendly</h1><p>Tbilisi Football Academy · Black Sea Juniors</p></div></header><div className="mx-stack"><MatchResultSection match={match} reload={() => {}} /></div></main>} /><Route path="*" element={<main className="mx-page">Local review destination</main>} /></Routes></MemoryRouter></I18nextProvider>);
