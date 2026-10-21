import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { apiClient } from '../../src/api/axiosConfig';
import { ApplicationsTab, type ApplicationFilters } from '../../src/components/workspace/tabs/ApplicationsTab';
import { TryoutsTab } from '../../src/components/workspace/tabs/TryoutsTab';
import { DecisionNoteModal } from '../../src/components/workspace/tabs/DecisionNoteModal';
import { ClubJourneyPanel } from '../../src/features/journey/components/ClubJourneyPanel';
import type { ClubMembershipApplication } from '../../src/features/clubs/domain';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';
import './squads-preview.css';

// In-memory fixture only. Product components keep their production APIs.
const params = new URLSearchParams(location.search);
if (params.has('lang')) void i18n.changeLanguage(params.get('lang')!);
let sessions = [
    { id: 1, clubId: 71, title: 'U17 Open Tryout', tryoutDate: '2026-10-10T18:00:00', deadline: '2026-10-08T20:00:00', position: 'ALL POSITIONS', ageGroup: 'U17', description: 'Meet at pitch 2. Bring boots, shin pads and water.', gender: null },
    { id: 2, clubId: 71, title: 'Goalkeeper assessment', tryoutDate: '2026-10-12T16:00:00', deadline: null, position: 'GOALKEEPER', ageGroup: 'U19', description: 'An afternoon with our goalkeeping coaches.', gender: null },
];
const journey = {
    applications: [{ applicationId: 1, clubId: 71, clubName: 'Metro United Academy', role: 'PLAYER', status: 'PENDING', createdAt: '2026-09-12T10:00:00' }],
    invitations: [{ inviteId: 4, clubId: 72, clubName: 'Creekside FC', role: 'PLAYER', expiresAt: '2026-10-01T12:00:00' }],
    affiliations: [{ clubId: 73, clubName: 'Lakeside Athletic', status: 'TRIALIST', squadName: 'U17', trialEndsOn: '2026-10-16', consentStatus: 'PENDING' }],
    tryouts: [{ tryoutApplicationId: 5, clubId: 73, tryoutId: 1, clubName: 'Lakeside Athletic', title: 'U17 Open Tryout', tryoutDate: '2026-10-10T18:00:00', status: 'ACCEPTED', decisionMessage: 'See you on Thursday at 18:00, pitch 2. Bring boots, shin pads and water.' }],
    recentDecisions: [],
};
apiClient.defaults.adapter = async (config) => {
    let data: unknown = {};
    if (config.url === '/tryouts' && config.method === 'get') data = { content: sessions };
    else if (config.url === '/tryouts' && config.method === 'post') { const payload = JSON.parse(config.data); const created = { ...payload, id: Date.now() }; sessions = [...sessions, created]; data = created; }
    else if (config.url?.startsWith('/tryouts/') && config.method === 'put') { const id = Number(config.url.split('/').at(-1)); sessions = sessions.map((session) => session.id === id ? { ...session, ...JSON.parse(config.data) } : session); }
    else if (config.url?.startsWith('/tryouts/') && config.method === 'delete') sessions = sessions.filter((session) => session.id !== Number(config.url!.split('/').at(-1)));
    else if (config.url?.includes('journey')) data = journey;
    return { data, status: 200, statusText: 'OK', config, headers: {} };
};
const initialApplications: ClubMembershipApplication[] = [
    { id: 501, userId: 21, fullName: 'Luka Trialist', username: 'luka.trial', role: 'PLAYER', status: 'PENDING', message: 'I would love to join your U17 squad. I have played as a striker for three seasons and can attend training on weekdays.', createdAt: '2026-09-13T10:00:00', position: 'STRIKER', ageGroup: 'U17', age: 16, preferredFoot: 'LEFT', heightCm: 176, currentClubName: 'Saburtalo Academy', careerHistoryCount: 2, isMinor: true, currentConsentStatus: 'PENDING' },
    { id: 502, userId: 22, fullName: 'Nika Goalkeeper', username: 'nika.gk', role: 'PLAYER', status: 'PENDING', message: 'Goalkeeper looking for a club with regular training.', createdAt: '2026-09-12T10:00:00', position: 'GOALKEEPER', ageGroup: 'U19', age: 18, preferredFoot: 'RIGHT', heightCm: 188, careerHistoryCount: 2 },
    { id: 503, userId: 23, fullName: 'Ana Giorgadze', username: 'ana.g', role: 'COACH', status: 'PENDING', message: 'UEFA B coach with five years of youth coaching experience.', createdAt: '2026-09-12T08:00:00', ageGroup: 'U14', jobId: 12, jobTitle: 'Academy assistant coach', age: 29 },
];
export const Preview = () => {
    const [tab, setTab] = useState(params.get('tab') || 'applications');
    const [applications, setApplications] = useState(initialApplications);
    const [filters, setFilters] = useState<ApplicationFilters>({ position: '', ageGroup: '', status: 'PENDING', jobId: '' });
    const [decision, setDecision] = useState<{ id: number; accept: boolean } | null>(null);
    const [applicants, setApplicants] = useState([
        { id: 601, userId: 24, name: 'Saba Kapanadze', position: 'CENTRAL MIDFIELDER', ageGroup: 'U17', status: 'PENDING', matchScore: 0, attributes: {} },
        { id: 602, userId: 25, name: 'Giorgi Beridze', position: 'GOALKEEPER', ageGroup: 'U19', status: 'SHORTLISTED', matchScore: 0, attributes: {} },
        { id: 603, userId: 26, name: 'Davit Maisuradze', position: 'CENTER BACK', ageGroup: 'U17', status: 'ACCEPTED', matchScore: 0, attributes: {} },
    ]);
    return <MemoryRouter><div className="team-preview"><div className="tp-previewbar"><strong>Recruitment preview · in-memory sample data</strong><button type="button" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'ka' : 'en')}>EN / KA</button></div><header className="tp-topnav"><div className="tp-brand">GrassKickZ</div><div className="tp-global-search">Find your football</div><span className="tp-owner">GK</span></header><div className="tp-layout"><aside className="tp-sidebar"><div className="tp-club"><span>MU</span><div><strong>Metro United Academy</strong><small>Club workspace</small></div></div>{['applications', 'tryouts', 'journey'].map((key) => <a key={key} href={`?tab=${key}`} onClick={(event) => { event.preventDefault(); setTab(key); }} className={tab === key ? 'active' : ''}>{key === 'journey' ? 'Player club journey' : key[0].toUpperCase() + key.slice(1)}</a>)}</aside><main className="tp-main">
        {tab === 'applications' && <ApplicationsTab applications={applications.filter((app) => app.status === filters.status && (!filters.position || app.position === filters.position) && (!filters.ageGroup || app.ageGroup === filters.ageGroup))} applicationsLoading={false} applicationsError={null} filters={filters} bulkPending={false} onFiltersChange={setFilters} onRetry={() => undefined} onAcceptApplication={(id) => setDecision({ id, accept: true })} onDeclineApplication={(id) => setDecision({ id, accept: false })} onBulkDecide={async (ids, action) => { setApplications((items) => items.map((app) => ids.includes(app.id) ? { ...app, status: action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED' } : app)); return true; }} onOpenTryouts={() => setTab('tryouts')} onOpenPlayers={() => toast('The live workspace opens Players filtered to trialists.')} onOpenSquads={() => location.assign('./squads-preview.html')} />}
        {tab === 'tryouts' && <TryoutsTab clubId={71} tryoutApplicants={applicants} tryoutsLoading={false} pendingKey={null} onTryoutStatus={(id, status) => setDecision({ id, accept: status === 'ACCEPTED' })} onOpenApplications={() => setTab('applications')} onOpenPlayers={() => toast('The live workspace opens Players filtered to trialists.')} onOpenSquads={() => location.assign('./squads-preview.html')} />}
        {tab === 'journey' && <div style={{ maxWidth: 760, margin: '0 auto' }}><ClubJourneyPanel /></div>}
        {decision && <DecisionNoteModal title={decision.accept ? 'Accept application' : 'Decline application'} subtitle={decision.accept ? 'Add a note about what comes next.' : 'Send a thoughtful decision.'} saving={false} danger={!decision.accept} confirmLabel={decision.accept ? 'Accept' : 'Decline'} onClose={() => setDecision(null)} onConfirm={() => { setApplications((items) => items.map((app) => app.id === decision.id ? { ...app, status: decision.accept ? 'ACCEPTED' : 'DECLINED' } : app)); setApplicants((items) => items.map((app) => app.id === decision.id ? { ...app, status: decision.accept ? 'ACCEPTED' : 'REJECTED' } : app)); setDecision(null); }} />}
    </main></div></div><Toaster theme="dark" /></MemoryRouter>;
};
createRoot(document.getElementById('root')!).render(<Preview />);
