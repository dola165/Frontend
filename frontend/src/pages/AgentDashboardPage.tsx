import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { Briefcase, Building2, BellRing, LayoutDashboard } from 'lucide-react';
import { fetchAgentDashboard } from '../features/agents/api';
import type { AgentDashboardData } from '../features/agents/domain';
import { PageSpinner, ErrorBlock } from '../components/workspace/helpers';
import { AgentPortfolioTab } from '../components/agent/AgentPortfolioTab';
import { ClubRelationshipsTab } from '../components/agent/ClubRelationshipsTab';
import { useAuth } from '../context/AuthContext';

type DashboardTab = 'portfolio' | 'relationships' | 'inbox';

export const AgentDashboardPage = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Redirect non-AGENT users (defense-in-depth — route is also gated by AgentOnlyRoute)
    if (user && user.role !== 'AGENT') {
        return <Navigate to="/feed" replace />;
    }
    const [dashboard, setDashboard] = useState<AgentDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeTab: DashboardTab = (searchParams.get('tab') as DashboardTab) || 'portfolio';

    const setActiveTab = (tab: DashboardTab) => {
        const next = new URLSearchParams(searchParams);
        if (tab === 'portfolio') next.delete('tab');
        else next.set('tab', tab);
        setSearchParams(next, { replace: true });
    };

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAgentDashboard();
            setDashboard(data);
        } catch (err) {
            console.error('Failed to load agent dashboard', err);
            setError('Could not load your dashboard. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const tabs: { id: DashboardTab; label: string; icon: typeof LayoutDashboard; badge?: string }[] = [
        { id: 'portfolio', label: 'Portfolio', icon: LayoutDashboard, badge: dashboard ? String(dashboard.activePlayerCount) : undefined },
        { id: 'relationships', label: 'Club Relations', icon: Building2, badge: dashboard && dashboard.pendingEngagementCount > 0 ? String(dashboard.pendingEngagementCount) : undefined },
        { id: 'inbox', label: 'Inbox', icon: BellRing }
    ];

    return (
        <div className="flex h-[calc(100dvh-var(--app-header-height))] bg-[#0f1117]">
            {/* Sidebar */}
            <aside className="w-[220px] shrink-0 border-r border-[#ffffff0d] bg-[#0a0a0c] flex flex-col">
                <div className="px-4 py-5 border-b border-[#ffffff0d]">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-md bg-[#16a34a]/20 flex items-center justify-center">
                            <Briefcase className="w-4 h-4 text-[#16a34a]" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#f4f4f5]">
                                {dashboard?.agencyName || 'Agent Dashboard'}
                            </p>
                            {dashboard?.verified && (
                                <span className="text-[10px] font-medium text-[#16a34a]">Verified</span>
                            )}
                        </div>
                    </div>
                    {dashboard?.fifaLicenseNumber && (
                        <p className="text-[11px] text-[#71717a]">{dashboard.fifaLicenseNumber}</p>
                    )}
                </div>
                <nav className="flex-1 px-3 py-3 space-y-0.5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-[#16a34a]/10 text-[#16a34a] border-l-[3px] border-[#16a34a] pl-2.5'
                                    : 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[rgba(255,255,255,0.03)] border-l-[3px] border-transparent pl-2.5'
                            }`}
                        >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left">{tab.label}</span>
                            {tab.badge && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#16a34a]/20 text-[#16a34a]">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="px-4 py-3 border-t border-[#ffffff0d]">
                    <p className="text-[11px] text-[#71717a]">
                        Signed in as <span className="text-[#a1a1aa] font-medium">@{user?.username}</span>
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {loading && <PageSpinner />}
                {error && <ErrorBlock message={error} onRetry={loadDashboard} />}
                {!loading && !error && (
                    <div className="px-6 py-5">
                        {activeTab === 'portfolio' && (
                            <AgentPortfolioTab
                                players={dashboard?.portfolio || []}
                                onRefresh={loadDashboard}
                            />
                        )}
                        {activeTab === 'relationships' && (
                            <ClubRelationshipsTab />
                        )}
                        {activeTab === 'inbox' && (
                            <div className="py-12 text-center">
                                <p className="text-sm text-[#71717a]">Inbox is available from the club workspace.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
