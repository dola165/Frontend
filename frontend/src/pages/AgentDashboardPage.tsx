import { useEffect, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { BellRing, Briefcase, Building2, ChevronRight, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAgentHub, type AgentHubSection } from '../features/agents/useAgentHub';
import type { AgentDashboardData, AgentEngagement, AgentInterest } from '../features/agents/domain';
import { PageSpinner, SectionHeader } from '../components/workspace/helpers';
import { AgentPortfolioTab } from '../components/agent/AgentPortfolioTab';
import { AgentConnections } from '../features/agents/RepresentationPanel';
import { ClubRelationshipsTab } from '../components/agent/ClubRelationshipsTab';
import { AgentInboxTab } from '../components/agent/AgentInboxTab';
import { useAuth } from '../context/AuthContext';
import { hasNavigationCapability } from '../context/navigationCapabilities';
import { useAgentCopy, type AgentCopyKey } from '../features/agents/copy';
import type { AuthSessionId } from '../utils/authStorage';
import '../features/agents/agent-hub.css';

export type DashboardTab = 'overview' | 'inbox' | 'portfolio' | 'relationships';

const VALID_TABS = new Set<DashboardTab>(['overview', 'inbox', 'portfolio', 'relationships']);

export const AgentDashboardPage = () => {
    const { user, status, sessionId } = useAuth();

    if (status !== 'authenticated' || !user) return null;
    if (user.role !== 'AGENT' && !hasNavigationCapability(user.navigationCapabilities, 'agent.hub')) return <Navigate to="/home" replace />;

    return (
        <AgentDashboardContent
            key={`${sessionId}:${user.id}`}
            sessionId={sessionId}
            username={user.username}
        />
    );
};

const AgentDashboardContent = ({ sessionId, username }: { sessionId: AuthSessionId; username?: string }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const hub = useAgentHub(sessionId);
    const { data, load: loadHub } = hub;

    const requestedTab = searchParams.get('tab') as DashboardTab | null;
    const activeTab: DashboardTab = requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : 'overview';

    const setActiveTab = (tab: DashboardTab) => {
        const next = new URLSearchParams(searchParams);
        if (tab === 'overview') next.delete('tab');
        else next.set('tab', tab);
        setSearchParams(next, { replace: true });
    };

    useEffect(() => {
        const controller = new AbortController();
        void loadHub(controller.signal);
        return () => controller.abort();
    }, [loadHub]);

    useEffect(() => {
        const controller = new AbortController();
        const refresh = () => { if (!document.hidden) void loadHub(controller.signal, true); };
        window.addEventListener('representation-updated', refresh);
        window.addEventListener('club-approaches-updated', refresh);
        window.addEventListener('focus', refresh);
        const timer = window.setInterval(refresh, 15000);
        return () => {
            controller.abort();
            window.clearInterval(timer);
            window.removeEventListener('representation-updated', refresh);
            window.removeEventListener('club-approaches-updated', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [loadHub]);

    return (
        <AgentDashboardPresentation
            username={username}
            dashboard={data.dashboard}
            interests={data.interests}
            engagements={data.engagements}
            incomingRepresentationCount={data.representation}
            pendingApproachCount={data.approaches ? data.approaches.pending : null}
            activeApproachCount={data.approaches ? data.approaches.active : null}
            loading={hub.loading}
            error={!hub.loading && !data.dashboard && hub.failed.includes('dashboard')}
            problems={hub.failed}
            retrying={hub.retrying}
            onRetrySection={hub.retry}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onRetry={() => hub.retry('dashboard')}
        />
    );
};

export interface AgentDashboardPresentationProps {
    username?: string;
    dashboard: AgentDashboardData | null;
    /** Null means it could not be loaded: shown as unknown, never as none. */
    interests: AgentInterest[] | null;
    engagements: AgentEngagement[] | null;
    incomingRepresentationCount?: number | null;
    pendingApproachCount?: number | null;
    activeApproachCount?: number | null;
    loading: boolean;
    /** The agency and portfolio could not load: Overview and Portfolio cannot be shown. */
    error: boolean;
    /** Sections that failed to load or refresh, each with its own retry. */
    problems?: AgentHubSection[];
    retrying?: AgentHubSection[];
    onRetrySection?: (section: AgentHubSection) => void;
    activeTab: DashboardTab;
    onTabChange: (tab: DashboardTab) => void;
    onRetry: () => void;
}

export const AgentDashboardPresentation = ({
    username,
    dashboard,
    interests,
    engagements,
    incomingRepresentationCount = 0,
    pendingApproachCount = 0,
    activeApproachCount = 0,
    loading,
    error,
    problems = [],
    retrying = [],
    onRetrySection,
    activeTab,
    onTabChange,
    onRetry
}: AgentDashboardPresentationProps) => {
    const { copy } = useAgentCopy();
    const players = dashboard?.portfolio ?? [];
    // Each count is a number only when everything it adds up was loaded; otherwise it is unknown (null).
    const pendingConsentCount = dashboard ? players.filter(player =>
        player.requiresMinorConsent && player.minorConsentStatus !== 'ACCEPTED').length : null;
    const newInterestCount = interests ? interests.filter(interest => interest.status === 'EXPRESSED').length : null;
    const pendingRelationshipCount = engagements && pendingApproachCount !== null
        ? pendingApproachCount + engagements.filter(engagement => engagement.status === 'PENDING').length : null;
    const attention = attentionTotal([incomingRepresentationCount, pendingConsentCount, newInterestCount, pendingRelationshipCount]);

    const tabs = useMemo<Array<{ id: DashboardTab; label: string; icon: LucideIcon; badge?: number | string }>>(() => [
        { id: 'overview', label: copy('overview'), icon: LayoutDashboard, badge: attention.partial ? (attention.known ? `${attention.known}+` : undefined) : attention.known },
        { id: 'inbox', label: copy('enquiries'), icon: BellRing, badge: newInterestCount ?? undefined },
        { id: 'portfolio', label: copy('portfolio'), icon: Users, badge: dashboard?.activePlayerCount },
        { id: 'relationships', label: copy('relationships'), icon: Building2, badge: pendingRelationshipCount ?? undefined }
    ], [copy, dashboard?.activePlayerCount, attention.known, attention.partial, newInterestCount, pendingRelationshipCount]);

    const navButton = (tab: typeof tabs[number], compact = false) => {
        const selected = activeTab === tab.id;
        return (
            <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="agent-hub-panel"
                tabIndex={selected ? 0 : -1}
                onKeyDown={event => {
                    const previous = compact ? 'ArrowLeft' : 'ArrowUp';
                    const next = compact ? 'ArrowRight' : 'ArrowDown';
                    if (![previous, next, 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const index = tabs.findIndex(item => item.id === tab.id);
                    const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                        : (index + (event.key === next ? 1 : -1) + tabs.length) % tabs.length;
                    onTabChange(tabs[target].id);
                    event.currentTarget.closest('[role="tablist"]')
                        ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
                }}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-accent)] ${compact ? 'shrink-0 px-3 py-2' : 'w-full px-3 py-2.5'} ${
                    selected
                        ? 'bg-[var(--fc-accent-soft)] text-[var(--fc-accent)]'
                        : 'text-[var(--fc-text-secondary)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]'
                }`}
            >
                <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={compact ? '' : 'flex-1 text-left'}>{tab.label}</span>
                {Boolean(tab.badge) && (
                    <span className="rounded-full bg-[var(--fc-accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fc-accent)]">
                        {tab.badge}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="agent-hub min-h-[calc(100dvh-var(--app-header-height))] bg-[var(--fc-page-bg)] text-[var(--fc-text-primary)] md:flex">
            <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--fc-border)] bg-[var(--fc-card-bg)] md:flex">
                <div className="border-b border-[var(--fc-border)] px-5 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--fc-accent-soft)]">
                            <Briefcase className="h-5 w-5 text-[var(--fc-accent)]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-sm font-bold">{dashboard?.agencyName || copy('agentHub')}</h1>
                            {dashboard?.verified ? (
                                <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[var(--fc-state-success)]">
                                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {copy('verifiedAgent')}
                                </p>
                            ) : (
                                <p className="mt-0.5 text-xs text-[var(--fc-text-muted)]">{copy('privateWorkspace')}</p>
                            )}
                        </div>
                    </div>
                    {dashboard?.fifaLicenseNumber && (
                        <p className="mt-3 text-xs text-[var(--fc-text-muted)]">{copy('licence', { value: dashboard.fifaLicenseNumber })}</p>
                    )}
                </div>
                <nav className="flex-1 space-y-1 p-3" role="tablist" aria-orientation="vertical" aria-label={copy('agentHub')}>
                    {tabs.map(tab => navButton(tab))}
                </nav>
                {username && (
                    <p className="border-t border-[var(--fc-border)] px-5 py-4 text-xs text-[var(--fc-text-muted)]">
                        {copy('signedInAs', { value: username })}
                    </p>
                )}
            </aside>

            <main className="min-w-0 flex-1">
                <header className="border-b border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-4 py-4 md:hidden">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--fc-accent-soft)]">
                            <Briefcase className="h-4 w-4 text-[var(--fc-accent)]" aria-hidden="true" />
                        </div>
                        <div>
                            <h1 className="font-bold">{dashboard?.agencyName || copy('agentHub')}</h1>
                            <p className="text-xs text-[var(--fc-text-muted)]">{copy('mobileSubtitle')}</p>
                        </div>
                    </div>
                    <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={copy('agentHub')}>
                        {tabs.map(tab => navButton(tab, true))}
                    </nav>
                </header>

                <div id="agent-hub-panel" role="tabpanel" aria-label={tabs.find(tab => tab.id === activeTab)?.label} tabIndex={0} className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
                    {loading && <div role="status" aria-label={copy('loadingHub')}><PageSpinner /></div>}
                    {!loading && <HubProblems problems={problems.filter(section => !(error && section === 'dashboard' && needsDashboard(activeTab)))}
                        stale={section => section === 'dashboard' ? Boolean(dashboard) : section === 'interests' ? interests !== null : section === 'engagements' ? engagements !== null : section === 'representation' ? incomingRepresentationCount !== null : activeApproachCount !== null}
                        retrying={retrying} onRetry={onRetrySection} />}
                    {error && needsDashboard(activeTab) && (
                        <div role="alert" className="rounded-xl border border-[var(--fc-state-danger-soft)] bg-[var(--fc-state-danger-soft)] px-6 py-10 text-center">
                            <h2 className="text-base font-semibold text-[var(--fc-text-primary)]">{copy('errorTitle')}</h2>
                            <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--fc-text-secondary)]">{copy('hubLoadError')}</p>
                            <button type="button" onClick={onRetry} className="agent-hub-retry mt-4 rounded-xl bg-[var(--fc-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-accent)]">
                                {copy('retry')}
                            </button>
                        </div>
                    )}
                    {!loading && (
                        <>
                            {activeTab === 'overview' && dashboard && (
                                <AgentOverview
                                    dashboard={dashboard}
                                    pendingConsentCount={pendingConsentCount}
                                    newInterestCount={newInterestCount}
                                    pendingRelationshipCount={pendingRelationshipCount}
                                    incomingRepresentationCount={incomingRepresentationCount}
                                    activeApproachCount={activeApproachCount}
                                    attention={attention}
                                    onOpen={onTabChange}
                                />
                            )}
                            {activeTab === 'inbox' && interests && <AgentInboxTab interests={interests} />}
                            {activeTab === 'portfolio' && dashboard && <><AgentConnections /><AgentPortfolioTab players={players} /></>}
                            {activeTab === 'relationships' && engagements && <ClubRelationshipsTab engagements={engagements} />}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

/** Overview and Portfolio are built on the agency's own record; Enquiries and Club relationships stand alone. */
const needsDashboard = (tab: DashboardTab) => tab === 'overview' || tab === 'portfolio';

/** The attention total: what is known, and whether some part could not be counted. */
const attentionTotal = (counts: Array<number | null>) =>
    ({ known: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0), partial: counts.some(count => count === null) });

const sectionNames: Record<AgentHubSection, AgentCopyKey> = {
    dashboard: 'sectionDashboard', interests: 'sectionEnquiries', engagements: 'sectionRelationships', representation: 'sectionRepresentation', approaches: 'sectionApproaches',
};

/** One line per section that could not load (or refresh), each with its own retry; the rest of the hub stays usable. */
const HubProblems = ({ problems, stale, retrying, onRetry }: { problems: AgentHubSection[]; stale: (section: AgentHubSection) => boolean; retrying: AgentHubSection[]; onRetry?: (section: AgentHubSection) => void }) => {
    const { copy } = useAgentCopy();
    if (!problems.length) return null;
    return <div role="status" className="mb-5 space-y-2">
        {problems.map(section => <div key={section} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--fc-state-warning-soft)] bg-[var(--fc-state-warning-soft)] px-4 py-3">
            <p className="text-sm text-[var(--fc-text-primary)]">{copy(stale(section) ? 'sectionStale' : 'sectionFailed', { what: copy(sectionNames[section]) })}</p>
            {onRetry && <button type="button" disabled={retrying.includes(section)} onClick={() => onRetry(section)} className="min-h-[36px] rounded-lg border border-[var(--fc-border)] bg-[var(--fc-card-bg)] px-3 text-sm font-semibold text-[var(--fc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-accent)] disabled:opacity-60">
                {retrying.includes(section) ? copy('retrying') : copy('retry')}
            </button>}
        </div>)}
    </div>;
};

interface OverviewProps {
    dashboard: AgentDashboardData;
    pendingConsentCount: number | null;
    newInterestCount: number | null;
    pendingRelationshipCount: number | null;
    incomingRepresentationCount: number | null;
    activeApproachCount: number | null;
    attention: { known: number; partial: boolean };
    onOpen: (tab: DashboardTab) => void;
}

const AgentOverview = ({ dashboard, pendingConsentCount, newInterestCount, pendingRelationshipCount, incomingRepresentationCount, activeApproachCount, attention, onOpen }: OverviewProps) => {
    const { copy } = useAgentCopy();
    const title = attention.partial ? (attention.known ? copy('attentionAtLeast', { count: attention.known }) : copy('attentionUnknown'))
        : attention.known > 0 ? copy('attentionCount', { count: attention.known, suffix: attention.known === 1 ? '' : 's' }) : copy('nextActionsClear');
    const actions = [
        { id: 'portfolio' as const, icon: Users, count: incomingRepresentationCount, title: copy('incomingRepresentation'), detail: copy('incomingRepresentationDetail') },
        { id: 'inbox' as const, icon: BellRing, count: newInterestCount, title: copy('newEnquiries'), detail: copy('newEnquiriesDetail') },
        { id: 'portfolio' as const, icon: ShieldCheck, count: pendingConsentCount, title: copy('representationConsent'), detail: copy('representationConsentDetail') },
        { id: 'relationships' as const, icon: Building2, count: pendingRelationshipCount, title: copy('clubDecisionsPending'), detail: copy('clubDecisionsDetail') }
    ];

    return (
        <section aria-label={copy('overview')}>
            <SectionHeader
                eyebrow={copy('agentHub')}
                title={title}
                description={copy('overviewDescription')}
            />
            <button type="button" className="career-button career-primary" onClick={() => onOpen('portfolio')}>{copy('findPlayer')}</button>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {actions.map(action => (
                    <button key={action.title} type="button" onClick={() => onOpen(action.id)} className="group rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-4 text-left transition-colors hover:bg-[var(--fc-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fc-accent)]">
                        <div className="flex items-center justify-between"><action.icon className="h-5 w-5 text-[var(--fc-accent)]" aria-hidden="true" />{action.count === null
                            ? <span className="text-2xl font-bold text-[var(--fc-text-muted)]" aria-label={copy('countUnknown')}>–</span>
                            : <span className="text-2xl font-bold text-[var(--fc-text-primary)]">{action.count}</span>}</div>
                        <h3 className="mt-4 font-semibold text-[var(--fc-text-primary)]">{action.title}</h3>
                        <p className="mt-1 text-sm leading-5 text-[var(--fc-text-secondary)]">{action.count === null ? copy('countUnknown') : action.detail}</p>
                        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--fc-accent)]">{copy('open')} <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
                    </button>
                ))}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-muted)]">{copy('currentRepresentationRecords')}</p>
                    <p className="mt-2 text-3xl font-bold">{dashboard.activePlayerCount}</p>
                    <p className="mt-2 text-sm text-[var(--fc-text-secondary)]">{copy('representationRecordsDetail')}</p>
                </div>
                <div className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-card-bg)] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fc-text-muted)]">{copy('activeClubRelationships')}</p>
                    {/* Club relationships plus consented club approaches; without the approaches only a lower bound is known. */}
                    <p className="mt-2 text-3xl font-bold">{activeApproachCount === null ? `${dashboard.activeEngagementCount}+` : dashboard.activeEngagementCount + activeApproachCount}</p>
                    <p className="mt-2 text-sm text-[var(--fc-text-secondary)]">{activeApproachCount === null ? copy('approachesUnknown') : copy('activeRelationshipDetail')}</p>
                </div>
            </div>
        </section>
    );
};
