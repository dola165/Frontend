import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Briefcase, ShieldCheck, Users, Building2 } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { fetchAgentPortfolio } from '../features/agents/api';
import type { AgentPortfolioPlayer } from '../features/agents/domain';
import { PageSpinner, ErrorBlock } from '../components/workspace/helpers';
import { UserIdentityCell } from '../components/workspace/UserIdentityCell';

interface AgentProfile {
    id: number;
    username: string;
    fullName: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    role: string;
    agencyName: string | null;
    fifaLicenseNumber: string | null;
    agentVerified: boolean | null;
}

type ProfileTab = 'portfolio' | 'activity';

export const AgentProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [profile, setProfile] = useState<AgentProfile | null>(null);
    const [portfolio, setPortfolio] = useState<AgentPortfolioPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeTab: ProfileTab = (searchParams.get('tab') as ProfileTab) || 'portfolio';

    useEffect(() => {
        if (!id) return;
        let active = true;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [userRes, portfolioRes] = await Promise.all([
                    apiClient.get(`/users/${id}`),
                    fetchAgentPortfolio(Number(id))
                ]);
                if (active) {
                    setProfile(userRes.data);
                    setPortfolio(portfolioRes);
                }
            } catch (err) {
                if (active) {
                    console.error('Failed to load agent profile', err);
                    setError('Could not load agent profile.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [id]);

    if (loading) return <PageSpinner />;
    if (error) return <ErrorBlock message={error} onRetry={() => window.location.reload()} />;
    if (!profile || profile.role !== 'AGENT') {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-[#71717a] text-sm">Agent not found.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0f1117] min-h-[calc(100dvh-var(--app-header-height))]">
            {/* Hero */}
            <div className="relative h-[220px] bg-gradient-to-b from-[#0a0a0c] via-[#0f0f14] to-[#0f1117]">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f1117]" />
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end gap-4">
                    <div className="w-20 h-20 rounded-full bg-[#16a34a]/20 border-2 border-[#16a34a]/30 flex items-center justify-center shrink-0">
                        <Briefcase className="w-9 h-9 text-[#16a34a]" />
                    </div>
                    <div className="pb-2">
                        <h1 className="text-2xl font-semibold text-[#f4f4f5]">
                            {profile.agencyName || profile.fullName || `@${profile.username}`}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-[#a1a1aa]">@{profile.username}</span>
                            {profile.agentVerified && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#16a34a]">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="sticky top-0 z-10 bg-[#0f1117] border-b border-[#ffffff0d] px-6">
                <div className="flex gap-3">
                    {([
                        { id: 'portfolio' as ProfileTab, label: 'Portfolio', icon: Users, count: portfolio.length },
                        { id: 'activity' as ProfileTab, label: 'Activity', icon: Building2 }
                    ]).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                const next = new URLSearchParams(searchParams);
                                if (tab.id === 'portfolio') next.delete('tab');
                                else next.set('tab', tab.id);
                                setSearchParams(next, { replace: true });
                            }}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-[#16a34a] text-[#16a34a]'
                                    : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className="text-[11px] ml-0.5">({tab.count})</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-6">
                {activeTab === 'portfolio' && (
                    <div className="space-y-2">
                        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-wide mb-3">
                            Represented Players ({portfolio.length})
                        </h2>
                        {portfolio.length === 0 ? (
                            <p className="text-sm text-[#71717a] py-6 text-center">No players in portfolio yet.</p>
                        ) : (
                            portfolio.map(player => (
                                <div
                                    key={player.representationId}
                                    className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)]"
                                >
                                    <UserIdentityCell
                                        avatarUrl={player.avatarUrl}
                                        fullName={player.fullName}
                                        username={player.username}
                                        subtitle={player.currentClubName || 'No current club'}
                                    />
                                    <span className="text-xs text-[#a1a1aa]">{player.position || '—'}</span>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#16a34a]/10 text-[#16a34a]">
                                        {player.representationType}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'activity' && (
                    <div className="py-12 text-center">
                        <Building2 className="w-12 h-12 text-[#71717a] mx-auto mb-3" />
                        <p className="text-sm text-[#71717a]">Activity feed coming soon.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
