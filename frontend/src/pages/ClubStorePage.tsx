import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { ProductCard } from '../components/store/ProductCard';
import { ProductQuickViewModal } from '../components/store/ProductQuickViewModal';
import { fetchClubStoreProducts } from '../features/store/api';
import type { StoreProduct } from '../features/store/api';
import type { ClubProfile } from './ClubProfilePage';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

/**
 * Per-club storefront (WEB_APP_MASTER_PLAN.md §4.1) — the club's own
 * merchandise shelf, themed like the club profile it lives under.
 */
export const ClubStorePage = () => {
    const { id } = useParams<{ id: string }>();
    const clubId = Number(id);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [club, setClub] = useState<ClubProfile | null>(null);
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<StoreProduct | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [clubRes, productData] = await Promise.all([
                apiClient.get<ClubProfile>(`/clubs/${clubId}`),
                fetchClubStoreProducts(clubId),
            ]);
            setClub(clubRes.data);
            setProducts(productData);
        } catch (err) {
            console.error('Failed to load club store', err);
            setError('Could not load this club store.');
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="club-page-shell min-h-[calc(100dvh-var(--app-header-height))] bg-[color:var(--club-theme-base)]">
            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate(`/clubs/${clubId}`)}
                        className="rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] p-2 text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    {club?.logoUrl ? (
                        <img
                            src={resolveMediaUrl(club.logoUrl)}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover"
                        />
                    ) : (
                        <span className="h-12 w-12 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-[color:var(--club-theme-text-muted)]" />
                        </span>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-[color:var(--club-theme-text-primary)] truncate">
                            {club?.name ?? t('store.title')}
                        </h1>
                        <p className="text-xs text-[color:var(--club-theme-text-muted)]">
                            {t('store.clubSubtitle')}
                        </p>
                    </div>
                </div>

                {/* Shelf */}
                {loading ? (
                    <PageSpinner />
                ) : error ? (
                    <p className="text-sm text-[#d4737a] py-10 text-center">{error}</p>
                ) : products.length === 0 ? (
                    <EmptyStateCard
                        icon={ShoppingBag}
                        title={t('store.clubEmptyTitle')}
                        description={t('store.clubEmptyDescription')}
                        actionLabel={t('store.backToClub')}
                        onAction={() => navigate(`/clubs/${clubId}`)}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} onOpen={setSelected} />
                        ))}
                    </div>
                )}
            </div>

            <ProductQuickViewModal product={selected} onClose={() => setSelected(null)} />
        </div>
    );
};
