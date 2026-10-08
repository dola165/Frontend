import axios from 'axios';
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
    TRANSFER: 'bg-[color:var(--color-info)]/10 text-[color:var(--color-info)]',
    LOAN: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]',
    TRIAL: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]',
    OPEN_TO_OFFERS: 'bg-[color:var(--color-purple)]/10 text-[color:var(--color-purple)]'
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
        } catch (caught) {
            const err = axios.isAxiosError<{ message?: string }>(caught) ? caught : undefined;
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
        <div className="bg-[var(--color-surface)] min-h-[calc(100dvh-var(--app-header-height))]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[var(--color-surface)] border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-xl font-semibold text-[var(--color-text)] mb-3">Player Marketplace</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Type filter pills */}
                        <div className="flex gap-1.5">
                            {TYPE_OPTIONS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTypeFilter(t); setPage(0); }}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                        typeFilter === t
                                            ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                            : 'bg-[color-mix(in_srgb,_var(--color-ink)_5%,_transparent)] text-[var(--color-secondary)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-secondary)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(0); }}
                                placeholder="Search players..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-secondary)]"
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
                    <p className="text-sm text-[var(--color-danger)] py-10 text-center">{error}</p>
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
                                    className="rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[color-mix(in_srgb,_var(--color-ink)_2%,_transparent)] p-4 hover:border-[color-mix(in_srgb,_var(--color-border)_8.24%,_transparent)] transition-colors"
                                >
                                    {/* Player identity */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <AvatarCell
                                            avatarUrl={resolveMediaUrl(player.avatarUrl)}
                                            fallback={player.fullName || player.username || '?'}
                                            size="md"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-[var(--color-text)] truncate">{player.fullName}</p>
                                            <p className="text-xs text-[var(--color-secondary)]">
                                                {player.position || 'Unknown'}
                                                {player.age != null ? ` · ${player.age}y` : ''}
                                                {player.currentClubName ? ` · ${player.currentClubName}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Agent info with trust signals */}
                                    <div className="mb-3">
                                        <div className="text-xs text-[var(--color-secondary)] mb-1">
                                            Represented by{' '}
                                            <span className="font-medium text-[var(--color-secondary)]">
                                                {player.agencyName || 'Unknown Agent'}
                                                {player.agentVerified && (
                                                    <span className="ml-1 text-[10px] text-[var(--color-accent)]">✓</span>
                                                )}
                                            </span>
                                        </div>
                                        {/* LinkedIn-style connection counts */}
                                        <div className="flex items-center gap-3 text-[11px] text-[var(--color-secondary)]">
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
                                                <span className="flex items-center gap-1 text-[var(--color-accent)]">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {player.mutualConnections} mutual
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {player.description && (
                                        <p className="text-xs text-[var(--color-secondary)] mb-3 line-clamp-2">{player.description}</p>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[player.availabilityType] || 'bg-[var(--color-inset)]/10 text-[var(--color-secondary)]'}`}>
                                            {player.availabilityType.replace(/_/g, ' ')}
                                        </span>
                                        {isAuthenticated ? (
                                            <button
                                                onClick={() => myClubId ? setInterestListing(player) : navigate(`/messages?chatWith=${player.agentUserId}`)}
                                                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                                            >
                                                Express Interest →
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate('/login?next=/marketplace')}
                                                className="text-xs font-semibold text-[var(--color-secondary)] hover:text-[var(--color-secondary)] transition-colors"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-overlay)]/60" onClick={() => setInterestListing(null)}>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-[var(--color-text)]">Express Interest</h3>
                                <button onClick={() => setInterestListing(null)} className="text-[var(--color-secondary)] hover:text-[var(--color-secondary)]">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-[var(--color-secondary)] mb-3">
                                You're expressing interest in <span className="text-[var(--color-text)] font-medium">{interestListing.fullName}</span> — listed as {interestListing.availabilityType.replace(/_/g, ' ')}
                            </p>
                            <textarea
                                value={interestMessage}
                                onChange={e => setInterestMessage(e.target.value)}
                                placeholder="Add a message for the agent... (optional)"
                                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] resize-none h-20 mb-4 focus:outline-none focus:border-[var(--color-accent)]/50"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setInterestListing(null)}
                                    className="px-4 py-2 text-xs font-medium text-[var(--color-secondary)] hover:text-[var(--color-text)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleExpressInterest(interestListing)}
                                    disabled={interestSubmitting}
                                    className="px-4 py-2 text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-xl hover:bg-[var(--color-accent)] disabled:opacity-50"
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
