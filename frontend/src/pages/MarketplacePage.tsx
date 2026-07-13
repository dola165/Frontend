import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Link2, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';

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
    const [listings, setListings] = useState<MarketplacePlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const pageSize = 12;

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
    }, [typeFilter, search, page, myClubId]);

    useEffect(() => { loadListings(); }, [loadListings]);

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
                                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[#26282d] bg-[#0f1117] text-sm text-[#f4f4f5] outline-none focus:border-[#16a34a] placeholder:text-[#71717a]"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <PageSpinner label="Loading listings..." />
                ) : error ? (
                    <p className="text-sm text-[#d4737a] py-10 text-center">{error}</p>
                ) : listings.length === 0 ? (
                    <EmptyStateCard
                        icon={Users}
                        title="No listings yet"
                        description="No players are currently listed on the marketplace. Agents will post available players here."
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {listings.map(player => (
                                <div
                                    key={player.listingId}
                                    className="rounded-md border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] p-4 hover:border-[#ffffff15] transition-colors"
                                >
                                    {/* Player identity */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0 text-sm font-semibold text-[#a1a1aa]">
                                            {player.avatarUrl ? (
                                                <img src={player.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                (player.fullName || '?')[0].toUpperCase()
                                            )}
                                        </div>
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
                                                onClick={() => navigate(`/messages?chatWith=${player.agentUserId}`)}
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

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 mt-6">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs text-[#a1a1aa] disabled:opacity-30"
                                >
                                    Previous
                                </button>
                                <span className="text-xs text-[#71717a]">
                                    Page {page + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="px-3 py-1.5 rounded-md border border-[#26282d] text-xs text-[#a1a1aa] disabled:opacity-30"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
