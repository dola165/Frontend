import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { AxiosResponse } from 'axios';
import { apiClient } from '../../src/api/axiosConfig';
import { OverviewTab } from '../../src/components/workspace/tabs/OverviewTab';
import type { ClubManagementOverview, ClubPlayerAffiliation } from '../../src/features/clubs/domain';
import type { ScheduleEventOccurrence } from '../../src/features/schedule/api';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';
import './club-overview-preview.css';

const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get('lang') === 'ka' ? 'ka' : 'en');
const state = params.get('state');
const empty = state === 'empty';
const clubId = 71001;
const overview: ClubManagementOverview = {
    currentUserRole: 'OWNER', assignableInviteRoles: ['COACH'], assignableStaffRoles: ['COACH'],
    activePlayerCount: empty ? 0 : 42, trialistCount: empty ? 0 : 6, overdueTrialistCount: empty ? 0 : 2,
    pendingTryoutCount: empty ? 0 : 8,
    members: Array.from({ length: 7 }, (_, index) => ({ userId: index + 1, username: `staff${index + 1}`, role: 'COACH', roleEditable: true })),
    pendingApplications: empty ? [] : Array.from({ length: 5 }, (_, index) => ({ id: index + 1, userId: index + 100, username: `applicant${index}`, role: 'PLAYER', status: 'PENDING' })),
    pendingInvitations: empty ? [] : [{ id: 501, userId: 601, username: 'invited-coach', role: 'COACH', status: 'PENDING' }],
};
const consentPlayers: ClubPlayerAffiliation[] = [
    { userId: 110, fullName: 'Sandro Beridze', primary: true, status: 'TRIALIST', requiresParentalConsent: true },
    { userId: 111, fullName: 'Ana Kapanadze', primary: true, status: 'ACTIVE', requiresParentalConsent: true, parentalConsentStatus: 'PENDING' },
    { userId: 112, fullName: 'Giorgi Maisuradze', primary: true, status: 'TRIALIST', requiresParentalConsent: true, parentalConsentStatus: 'EXPIRED' },
];
let failed = false;
apiClient.defaults.adapter = async (config) => {
    if (!config.url?.endsWith(`/clubs/${clubId}/players`)) throw new Error(`Unexpected fixture request: ${config.url}`);
    if (state === 'error' && !failed) { failed = true; throw new Error('Fixture consent failure'); }
    const status = config.params.status;
    const total = status === 'ACTIVE' ? overview.activePlayerCount : overview.trialistCount;
    const selected = consentPlayers.filter((player) => player.status === status);
    const content = [...selected, ...Array.from({ length: Math.max(0, total - selected.length) }, (_, index) => ({
        userId: (status === 'ACTIVE' ? 1000 : 2000) + index, fullName: `Fixture player ${index}`, status, primary: true, requiresParentalConsent: false,
    }))];
    return { data: { content, totalElements: state === 'partial' ? total + 60 : total, pageNumber: 0, pageSize: 50 }, status: 200, statusText: 'OK', config, headers: {} } as AxiosResponse;
};

const event = (id: number, title: string, days: number, eventType: ScheduleEventOccurrence['eventType'], locationName: string): ScheduleEventOccurrence => {
    const start = new Date(); start.setDate(start.getDate() + days); start.setHours(18, 0, 0, 0);
    const end = new Date(start); end.setMinutes(end.getMinutes() + 90);
    return {
        eventId: id, occurrenceId: `${id}:${start.toISOString()}`, clubId, clubName: 'Academy FC', userId: null,
        eventType, title, description: null, startsAt: start.toISOString(), endsAt: end.toISOString(),
        locationName, locationLat: null, locationLng: null, visibility: 'PRIVATE', publishAt: null, publicNow: false,
        recurring: false, recurrence: null, opponentClubId: null, opponentClubName: null, challengeStatus: null,
        status: 'SCHEDULED', conflict: false, conflictingEventIds: [],
    };
};
const events = empty ? [] : [
    event(1, 'U16 · Evening training', 0, 'TRAINING', 'Academy · Pitch 2'),
    event(2, 'First team · Tactical session', 1, 'TRAINING', 'Main training ground'),
    event(3, 'U14 · Open tryouts', 2, 'TRYOUT', 'Academy · Pitch 1'),
    event(4, 'Academy FC vs. City United', 4, 'MATCH', 'Academy Stadium'),
];

function Fixture() {
    const [action, setAction] = useState('');
    const [scheduleError, setScheduleError] = useState(state === 'error' ? 'Fixture error' : null);
    const coach = params.get('role') === 'coach';
    const readonly = params.get('role') === 'readonly';
    return <div className={`overview-preview ${params.get('theme') === 'light' ? 'workspace-light' : ''}`}>
        <div className="overview-preview-caption">ISOLATED DESIGN PREVIEW · Fixture data · No live account changes</div>
        <div className="overview-preview-shell"><aside><strong>GrassKickZ<span>.</span></strong><small>ACADEMY FC</small><nav><b>Overview</b><span>Calendar</span><span>Players</span><span>Squads</span><span>Applications</span><span>Tryouts</span></nav></aside>
            <main><OverviewTab overview={overview} clubId={clubId} onTabChange={(tab) => setAction(`tab:${tab}`)} canManageLeadership={!coach && !readonly} canManageOperations={!readonly} upcomingEvents={events} scheduleLoading={state === 'loading'} scheduleError={scheduleError} tryoutPendingCount={0} unreadInboxCount={3} onOpenSchedule={() => setAction('calendar')} onRetrySchedule={() => setScheduleError(null)} onOpenPlayers={(status) => setAction(`players:${status}`)} />
                <output aria-label="Last preview action">{action}</output>
            </main>
        </div>
    </div>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><Fixture /></MemoryRouter>);
