import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, Users, Link2, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { PaginationBar, PaginationTopBar } from '../components/ui/PaginationBar';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { AvatarCell } from '../components/workspace/AvatarCell';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

interface MarketplacePlayer {
    listingId: number;
    playerUserId: number;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    position: string | null;
    age: number | null;
    currentClubName: string | null;
    agentUserId: number;
    agencyName: string | null;
    agentVerified: boolean;
    availabilityType: string;
    description: string | null;
    expectedFeeRange: string | null;
    preferredDestinations: string | null;
    createdAt: string;
    playersRepresented: number | null;
    clubConnections: number | null;
    mutualConnections: number | null;
}

interface PageResult {
    content: MarketplacePlayer[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
}

const TYPE_OPTIONS = ['ALL', 'TRANSFER', 'LOAN', 'TRIAL', 'OPEN_TO_OFFERS'] as const;

const TYPE_COLORS: Record<string, string> = {
    TRANSFER: 'bg-blue-500/10 text-blue-400',
    LOAN: 'bg-amber-500/10 text-amber-400',
    TRIAL: 'bg-green-500/10 text-green-400',
    OPEN_TO_OFFERS: 'bg-violet-500/10 text-violet-400'
};

export const MarketplacePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { t } = useTranslation();
    const [listings, setListings] = useState<MarketplacePlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize, setPageSize] = useState(12);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const [interestListing, setInterestListing] = useState<MarketplacePlayer | null>(null);
    const [interestMessage, setInterestMessage] = useState('');
    const [interestSubmitting, setInterestSubmitting] = useState(false);

    // M13: Submit marketplace interest
    const handleExpressInterest = async (player: MarketplacePlayer) => {
        if (!myClubId) {
            navigate(`/messages?chatWith=${player.agentUserId}`);
            return;
        }
        try {
            setInterestSubmitting(true);
            await apiClient.post(`/agents/marketplace/listings/${player.listingId}/interest`, {
                clubId: myClubId,
                message: interestMessage || undefined
            });
            setInterestListing(null);
            setInterestMessage('');
            navigate(`/messages?chatWith=${player.agentUserId}`);
        } catch (err: any) {
            if (err?.response?.status === 409) {
                alert('Your club has already expressed interest in this player.');
            }
        } finally {
            setInterestSubmitting(false);
        }
    };

    // Detect viewer's club for mutual connections
    useEffect(() => {
        apiClient.get('/clubs/my-club')
            .then(res => {
                if (res.data?.id) setMyClubId(res.data.id);
            })
            .catch(() => { /* user has no club — no mutual connections */ });
    }, []);

    const loadListings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get<PageResult>('/agents/marketplace/listings', {
                params: {
                    type: typeFilter === 'ALL' ? undefined : typeFilter,
                    search: search || undefined,
                    viewerClubId: myClubId || undefined,
                    page,
                    size: pageSize
                }
            });
            setListings(res.data.content);
            setTotalElements(res.data.totalElements);
        } catch (err) {
            console.error('Failed to load marketplace', err);
            setError('Could not load marketplace listings.');
        } finally {
            setLoading(false);
        }
    }, [typeFilter, search, page, pageSize, myClubId]);

    useEffect(() => { loadListings(); }, [loadListings]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(0);
    };

    const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));

    return (
        <div className="bg-[#0f1117] min-h-[calc(100dvh-var(--app-header-height))]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f1117] border-b border-[#ffffff0d] px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-xl font-semibold text-[#f4f4f5] mb-3">Player Marketplace</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Type filter pills */}
                        <div className="flex gap-1.5">
                            {TYPE_OPTIONS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTypeFilter(t); setPage(0); }}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                        typeFilter === t
                                            ? 'bg-[#16a34a] text-white'
                                            : 'bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] hover:text-[#f4f4f5]'
                                    }`}
                                >
                                    {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(0); }}
                                placeholder="Search players..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a] placeholder:text-[#71717a]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <PageSpinner />
                ) : error ? (
                    <p className="text-sm text-[#d4737a] py-10 text-center">{error}</p>
                ) : listings.length === 0 ? (
                    <EmptyStateCard
                        icon={Users}
                        title="No listings yet"
                        description="No players are currently listed on the marketplace. Agents will post available players here."
                        actionLabel={t('marketplace.emptyCta')}
                        actionIcon={Building2}
                        onAction={() => navigate('/clubs')}
                    />
                ) : (
                    <>
                        {totalElements > 0 && (
                            <PaginationTopBar totalElements={totalElements} pageSize={pageSize} onPageSizeChange={handlePageSizeChange} label="players listed" />
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {listings.map(player => (
                                <div
                                    key={player.listingId}
                                    className="rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] p-4 hover:border-[#ffffff15] transition-colors"
                                >
                                    {/* Player identity */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <AvatarCell
                                            avatarUrl={resolveMediaUrl(player.avatarUrl)}
                                            fallback={player.fullName || player.username || '?'}
                                            size="md"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[#f4f4f5] truncate">{player.fullName}</p>
                                            <p className="text-xs text-[#71717a]">
                                                {player.position || 'Unknown'}
                                                {player.age != null ? ` · ${player.age}y` : ''}
                                                {player.currentClubName ? ` · ${player.currentClubName}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Agent info with trust signals */}
                                    <div className="mb-3">
                                        <div className="text-xs text-[#71717a] mb-1">
                                            Represented by{' '}
                                            <span className="font-medium text-[#a1a1aa]">
                                                {player.agencyName || 'Unknown Agent'}
                                                {player.agentVerified && (
                                                    <span className="ml-1 text-[10px] text-[#16a34a]">✓</span>
                                                )}
                                            </span>
                                        </div>
                                        {/* LinkedIn-style connection counts */}
                                        <div className="flex items-center gap-3 text-[11px] text-[#71717a]">
                                            {player.playersRepresented != null && player.playersRepresented > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {player.playersRepresented} player{player.playersRepresented !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {player.clubConnections != null && player.clubConnections > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Link2 className="w-3 h-3" />
                                                    {player.clubConnections} connection{player.clubConnections !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                            {player.mutualConnections != null && player.mutualConnections > 0 && (
                                                <span className="flex items-center gap-1 text-[#16a34a]">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {player.mutualConnections} mutual
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {player.description && (
                                        <p className="text-xs text-[#71717a] mb-3 line-clamp-2">{player.description}</p>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[player.availabilityType] || 'bg-[#71717a]/10 text-[#71717a]'}`}>
                                            {player.availabilityType.replace(/_/g, ' ')}
                                        </span>
                                        {isAuthenticated ? (
                                            <button
                                                onClick={() => myClubId ? setInterestListing(player) : navigate(`/messages?chatWith=${player.agentUserId}`)}
                                                className="text-xs font-semibold text-[#16a34a] hover:text-[#22c55e] transition-colors"
                                            >
                                                Express Interest →
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate('/login?next=/marketplace')}
                                                className="text-xs font-semibold text-[#71717a] hover:text-[#a1a1aa] transition-colors"
                                            >
                                                Sign in to contact →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <PaginationBar
                            page={page}
                            totalPages={totalPages}
                            totalElements={totalElements}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                )}

                {/* M13: Express Interest Modal */}
                {interestListing && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setInterestListing(null)}>
                        <div className="bg-[#0f1117] border border-[#26282d] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-[#f4f4f5]">Express Interest</h3>
                                <button onClick={() => setInterestListing(null)} className="text-[#71717a] hover:text-[#a1a1aa]">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-[#a1a1aa] mb-3">
                                You're expressing interest in <span className="text-[#f4f4f5] font-medium">{interestListing.fullName}</span> — listed as {interestListing.availabilityType.replace(/_/g, ' ')}
                            </p>
                            <textarea
                                value={interestMessage}
                                onChange={e => setInterestMessage(e.target.value)}
                                placeholder="Add a message for the agent... (optional)"
                                className="w-full bg-[#16181d] border border-[#26282d] rounded-xl px-3 py-2 text-sm text-[#f4f4f5] placeholder-[#71717a] resize-none h-20 mb-4 focus:outline-none focus:border-[#16a34a]/50"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setInterestListing(null)}
                                    className="px-4 py-2 text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleExpressInterest(interestListing)}
                                    disabled={interestSubmitting}
                                    className="px-4 py-2 text-xs font-semibold bg-[#16a34a] text-white rounded-xl hover:bg-[#22c55e] disabled:opacity-50"
                                >
                                    {interestSubmitting ? 'Submitting...' : 'Express Interest'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
