import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, MapPin, Clock, Target } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { PaginationBar, PaginationTopBar } from '../components/ui/PaginationBar';

interface ClubNeed {
    needId: number;
    clubId: number;
    clubName: string;
    position: string | null;
    ageGroup: string | null;
    needType: string;
    description: string | null;
    createdAt: string;
}

const TYPE_OPTIONS = ['ALL', 'IMMEDIATE', 'UPCOMING_SEASON', 'DEVELOPMENT'] as const;

const TYPE_COLORS: Record<string, string> = {
    IMMEDIATE: 'bg-red-500/10 text-red-400',
    UPCOMING_SEASON: 'bg-amber-500/10 text-amber-400',
    DEVELOPMENT: 'bg-blue-500/10 text-blue-400'
};

const NEED_LABELS: Record<string, string> = {
    IMMEDIATE: 'Immediate',
    UPCOMING_SEASON: 'Upcoming Season',
    DEVELOPMENT: 'Development'
};

export const NeedsBoardPage = () => {
    const navigate = useNavigate();
    const [needs, setNeeds] = useState<ClubNeed[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [page, setPage] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize, setPageSize] = useState(12);

    const loadNeeds = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get<ClubNeed[]>('/agents/player-needs', {
                params: {
                    needType: typeFilter === 'ALL' ? undefined : typeFilter,
                    page,
                    size: pageSize
                }
            });
            // Backend returns a plain list; derive pagination info
            const data = Array.isArray(res.data) ? res.data : [];
            setNeeds(data);
            setTotalElements(data.length >= pageSize ? (page + 2) * pageSize : data.length);
        } catch (err) {
            console.error('Failed to load player needs', err);
            setError('Could not load club needs.');
        } finally {
            setLoading(false);
        }
    }, [typeFilter, page, pageSize]);

    useEffect(() => { loadNeeds(); }, [loadNeeds]);

    const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
    const hasMore = needs.length === pageSize;

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(0);
    };

    return (
        <div className="bg-[#0f1117] min-h-[calc(100dvh-var(--app-header-height))]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f1117] border-b border-[#ffffff0d] px-6 py-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="text-xl font-semibold text-[#f4f4f5]">Club Player Needs</h1>
                        <span className="text-xs text-[#71717a] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded-full">
                            Reverse Marketplace
                        </span>
                    </div>
                    <p className="text-xs text-[#71717a] mb-3">
                        Clubs post the positions they're recruiting for. Agents — match your players to active needs.
                    </p>
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
                                    {t === 'ALL' ? 'All Needs' : NEED_LABELS[t] || t.replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-5">
                {loading ? (
                    <PageSpinner label="Loading club needs..." />
                ) : error ? (
                    <p className="text-sm text-[#d4737a] py-10 text-center">{error}</p>
                ) : needs.length === 0 ? (
                    <EmptyStateCard
                        icon={Target}
                        title="No club needs yet"
                        description="No clubs have posted player needs. Clubs can post positions they're recruiting for from their workspace."
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {needs.map(need => (
                                <div
                                    key={need.needId}
                                    className="rounded-md border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] p-4 hover:border-[#ffffff15] transition-colors"
                                >
                                    {/* Club identity */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0 text-sm font-semibold text-[#a1a1aa]">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => navigate(`/clubs/${need.clubId}`)}
                                                className="text-sm font-semibold text-[#f4f4f5] truncate hover:text-[#16a34a] transition-colors text-left"
                                            >
                                                {need.clubName}
                                            </button>
                                            <p className="text-xs text-[#71717a]">
                                                {need.position ? `${need.position}` : 'Any position'}
                                                {need.ageGroup ? ` · ${need.ageGroup}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Need details */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {need.position && (
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#a1a1aa]">
                                                {need.position}
                                            </span>
                                        )}
                                        {need.ageGroup && (
                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[#a1a1aa]">
                                                {need.ageGroup}
                                            </span>
                                        )}
                                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[need.needType] || 'bg-[#71717a]/10 text-[#71717a]'}`}>
                                            {NEED_LABELS[need.needType] || need.needType}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {need.description && (
                                        <p className="text-xs text-[#71717a] mb-3 line-clamp-2">{need.description}</p>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-[11px] text-[#71717a]">
                                            <Clock className="w-3 h-3" />
                                            {new Date(need.createdAt).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={() => navigate(`/clubs/${need.clubId}`)}
                                            className="text-xs font-semibold text-[#16a34a] hover:text-[#22c55e] transition-colors"
                                        >
                                            View Club →
                                        </button>
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
            </div>
        </div>
    );
};
