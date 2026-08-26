import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Search, ShoppingBag } from 'lucide-react';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { PaginationBar } from '../components/ui/PaginationBar';
import { ProductCard } from '../components/store/ProductCard';
import { ProductQuickViewModal } from '../components/store/ProductQuickViewModal';
import { fetchAllStoreCatalog, STORE_CATEGORIES } from '../features/store/api';
import type { StoreProduct, StoreProductCategory } from '../features/store/api';

interface RegionFilter {
    country: string | null;
    city: string | null;
    clubId: number | null;
}

const EMPTY_REGION: RegionFilter = { country: null, city: null, clubId: null };

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
    const [regionOpen, setRegionOpen] = useState(false);
    const [region, setRegion] = useState<RegionFilter>(EMPTY_REGION);
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

    /** country → city → clubs tree, derived from the catalog itself. */
    const locationTree = useMemo(() => {
        const map = new Map<string, Map<string, Map<number, string>>>();
        for (const p of products) {
            if (!p.clubCountryName || p.clubId == null) continue;
            const country = p.clubCountryName;
            const city = p.clubCityName ?? '';
            if (!map.has(country)) map.set(country, new Map());
            const cities = map.get(country)!;
            if (!cities.has(city)) cities.set(city, new Map());
            cities.get(city)!.set(p.clubId, p.clubName ?? '');
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([country, cities]) => ({
                country,
                cities: Array.from(cities.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([city, clubs]) => ({
                        city,
                        clubs: Array.from(clubs.entries())
                            .sort((a, b) => a[1].localeCompare(b[1]))
                            .map(([id, name]) => ({ id, name })),
                    })),
            }));
    }, [products]);

    const regionClubs = useMemo(() => {
        const list: { id: number; name: string }[] = [];
        for (const c of locationTree) {
            if (region.country && c.country !== region.country) continue;
            for (const city of c.cities) {
                if (region.city && city.city !== region.city) continue;
                list.push(...city.clubs);
            }
        }
        return list;
    }, [locationTree, region.country, region.city]);

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

    const isRegionActive = region.country != null || region.city != null || region.clubId != null;

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
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#0f1117] border-b border-[#ffffff0d] px-6 py-4">
                <div className="max-w-6xl mx-auto">
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
                        <button
                            onClick={() => setRegionOpen((v) => !v)}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                regionOpen || isRegionActive
                                    ? 'border-[#16a34a]/40 bg-[#16a34a]/10 text-[#16a34a]'
                                    : 'border-[#26282d] bg-[#16181d] text-[#a1a1aa] hover:text-[#f4f4f5]'
                            }`}
                        >
                            <MapPin className="h-3.5 w-3.5" />
                            {t('store.filterByClubs')}
                        </button>
                    </div>

                    {/* Club filter panel — country → city → club */}
                    {regionOpen && (
                        <div className="mt-3 rounded-xl border border-[#26282d] bg-[#16181d] p-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <select
                                    value={region.country ?? ''}
                                    onChange={(e) => {
                                        setRegion((r) => ({ ...r, country: e.target.value || null, city: null, clubId: null }));
                                        setPage(0);
                                    }}
                                    className={inputClass}
                                >
                                    <option value="">{t('store.anyCountry')}</option>
                                    {locationTree.map((c) => (
                                        <option key={c.country} value={c.country}>{c.country}</option>
                                    ))}
                                </select>
                                <select
                                    value={region.city ?? ''}
                                    disabled={!region.country}
                                    onChange={(e) => {
                                        setRegion((r) => ({ ...r, city: e.target.value || null, clubId: null }));
                                        setPage(0);
                                    }}
                                    className={`${inputClass} disabled:opacity-40`}
                                >
                                    <option value="">{t('store.anyCity')}</option>
                                    {(locationTree.find((c) => c.country === region.country)?.cities ?? []).map((city) => (
                                        <option key={city.city} value={city.city}>{city.city || '—'}</option>
                                    ))}
                                </select>
                                <select
                                    value={region.clubId ?? ''}
                                    disabled={!region.country}
                                    onChange={(e) => {
                                        setRegion((r) => ({ ...r, clubId: e.target.value ? Number(e.target.value) : null }));
                                        setPage(0);
                                    }}
                                    className={`${inputClass} disabled:opacity-40`}
                                >
                                    <option value="">{t('store.anyClub')}</option>
                                    {regionClubs.map((club) => (
                                        <option key={club.id} value={club.id}>{club.name}</option>
                                    ))}
                                </select>
                                {isRegionActive && (
                                    <button
                                        onClick={() => { setRegion(EMPTY_REGION); setPage(0); }}
                                        className="text-xs font-semibold text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors"
                                    >
                                        {t('store.resetFilters')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

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
            <div className="max-w-6xl mx-auto px-6 py-5">
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
