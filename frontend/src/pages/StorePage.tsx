import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, ShoppingBag } from 'lucide-react';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { PaginationBar } from '../components/ui/PaginationBar';
import { ProductCard } from '../components/store/ProductCard';
import { ProductQuickViewModal } from '../components/store/ProductQuickViewModal';
import { fetchAllStoreCatalog, STORE_CATEGORIES } from '../features/store/api';
import type { StoreProduct, StoreProductCategory } from '../features/store/api';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { ClubLocationFilter } from '../components/discovery/ClubLocationFilter';
import { EMPTY_CLUB_REGION, type ClubRegionSelection } from '../components/discovery/clubLocationTypes';

/**
 * Aggregate store catalog (WEB_APP_MASTER_PLAN.md §4.1) — active products
 * across all clubs. Search + category chips + a "Filter by clubs" flow that
 * narrows by country → city → club, all derived from the fetched catalog.
 */
export const StorePage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'ALL' | StoreProductCategory>('ALL');
    const [region, setRegion] = useState<ClubRegionSelection>(EMPTY_CLUB_REGION);
    const [selected, setSelected] = useState<StoreProduct | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(12);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAllStoreCatalog();
            setProducts(data);
        } catch (err) {
            console.error('Failed to load store catalog', err);
            setError('Could not load the store catalog.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const clubLocationItems = useMemo(() => products.flatMap((product) => product.clubId == null ? [] : [{
        clubId: product.clubId,
        clubName: product.clubName ?? 'Club',
        cityName: product.clubCityName,
        countryName: product.clubCountryName,
    }]), [products]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return products.filter((p) => {
            if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
            if (region.country && p.clubCountryName !== region.country) return false;
            if (region.city && p.clubCityName !== region.city) return false;
            if (region.clubId != null && p.clubId !== region.clubId) return false;
            if (query) {
                const haystack = `${p.name ?? ''} ${p.description ?? ''} ${p.clubName ?? ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });
    }, [products, search, categoryFilter, region]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

    const handleCategory = (category: 'ALL' | StoreProductCategory) => {
        setCategoryFilter(category);
        setPage(0);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(0);
    };

    const inputClass = 'rounded-xl border border-[#26282d] bg-[#0f1117] px-3 py-1.5 text-sm text-[#f4f4f5] placeholder:text-[#71717a] focus:border-[#16a34a] outline-none';

    return (
        <div className="bg-[#0f1117] min-h-[calc(100dvh-var(--app-header-height))]">
            <DiscoverySectionTabs />
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-[#ffffff0d] bg-[#0f1117] py-4">
                <div className="w-full">
                    <div className="flex items-center gap-3 mb-3">
                        <h1 className="text-xl font-semibold text-[#f4f4f5]">{t('store.title')}</h1>
                        <span className="text-xs text-[#71717a] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded-full">
                            {t('store.clubMerchandise')}
                        </span>
                    </div>
                    <p className="text-xs text-[#71717a] mb-3">{t('store.subtitle')}</p>

                    {/* Search + club filter toggle */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71717a]" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                                placeholder={t('store.search')}
                                className={`${inputClass} pl-8 w-64`}
                            />
                        </div>
                        <ClubLocationFilter items={clubLocationItems} value={region} onChange={(next) => { setRegion(next); setPage(0); }} label={t('store.filterByClubs')} />
                    </div>

                    {/* Category chips */}
                    <div className="flex gap-1.5 flex-wrap mt-3">
                        <button
                            onClick={() => handleCategory('ALL')}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                categoryFilter === 'ALL'
                                    ? 'bg-[#16a34a] text-white'
                                    : 'bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] hover:text-[#f4f4f5]'
                            }`}
                        >
                            {t('store.allCategories')}
                        </button>
                        {STORE_CATEGORIES.map((category) => (
                            <button
                                key={category}
                                onClick={() => handleCategory(category)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                    categoryFilter === category
                                        ? 'bg-[#16a34a] text-white'
                                        : 'bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] hover:text-[#f4f4f5]'
                                }`}
                            >
                                {t(`store.categories.${category}`)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="w-full py-5">
                {loading ? (
                    <PageSpinner />
                ) : error ? (
                    <p className="text-sm text-[#d4737a] py-10 text-center">{error}</p>
                ) : filtered.length === 0 ? (
                    <EmptyStateCard
                        icon={ShoppingBag}
                        title={t('store.emptyTitle')}
                        description={t('store.emptyDescription')}
                        actionLabel={t('store.emptyCta')}
                        actionIcon={Building2}
                        onAction={() => navigate('/clubs')}
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visible.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onOpen={setSelected}
                                    showClub
                                />
                            ))}
                        </div>

                        <PaginationBar
                            page={page}
                            totalPages={totalPages}
                            totalElements={filtered.length}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </>
                )}
            </div>

            <ProductQuickViewModal product={selected} onClose={() => setSelected(null)} />
        </div>
    );
};
