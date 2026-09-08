import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ShoppingBag } from 'lucide-react';
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
import { DirectoryChoiceList, DirectoryFilterSection, DirectoryFilterShell, type DirectoryFilterChip } from '../components/discovery/DirectoryFilterShell';
import { DirectoryFilterDrawer } from '../components/discovery/DirectoryFilterDrawer';
import { DirectoryRangeFilter } from '../components/discovery/DirectoryRangeFilter';
import { DirectoryToolbar, type DirectorySortOption } from '../components/discovery/DirectoryToolbar';

type StoreSort = 'NEWEST' | 'PRICE_LOW' | 'PRICE_HIGH';

const SORT_OPTIONS: readonly DirectorySortOption[] = [
    { value: 'NEWEST', label: 'Newest' },
    { value: 'PRICE_LOW', label: 'Price: low to high' },
    { value: 'PRICE_HIGH', label: 'Price: high to low' }
];

const readRegion = (params: URLSearchParams): ClubRegionSelection => ({
    country: params.get('country') || null,
    city: params.get('city') || null,
    clubId: params.get('clubId') ? Number(params.get('clubId')) : null
});

const formatCategory = (category: string) => category.replace(/_/g, ' ');

export const StorePage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [categoryFilter, setCategoryFilter] = useState<'ALL' | StoreProductCategory>((searchParams.get('category') as StoreProductCategory | null) ?? 'ALL');
    const [region, setRegion] = useState<ClubRegionSelection>(() => readRegion(searchParams));
    const [priceMin, setPriceMin] = useState(Number(searchParams.get('priceMin')) || 0);
    const [priceMax, setPriceMax] = useState(Number(searchParams.get('priceMax')) || 0);
    const [size, setSize] = useState(searchParams.get('size') || 'ALL');
    const [sort, setSort] = useState<StoreSort>((searchParams.get('sort') as StoreSort | null) ?? 'NEWEST');
    const [selected, setSelected] = useState<StoreProduct | null>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const mobileFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileFilterCloseRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileFiltersOpen = useRef(false);
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
    const [pageSize, setPageSize] = useState(12);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setProducts(await fetchAllStoreCatalog());
        } catch (err) {
            console.error('Failed to load store catalog', err);
            setError('Could not load the store catalog.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const catalogPriceMax = useMemo(() => {
        const prices = products.map((product) => product.price).filter((price): price is number => price != null && Number.isFinite(price));
        return prices.length > 0 ? Math.max(1, Math.ceil(Math.max(...prices) / 10) * 10) : 0;
    }, [products]);
    const effectivePriceMax = priceMax > 0 ? Math.min(priceMax, catalogPriceMax || priceMax) : catalogPriceMax;

    // Keep local controls aligned with browser back/forward navigation.
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlCategory = searchParams.get('category') || 'ALL';
        const urlRegion = readRegion(searchParams);
        const urlPriceMin = Number(searchParams.get('priceMin')) || 0;
        const urlPriceMax = Number(searchParams.get('priceMax')) || 0;
        const urlSize = searchParams.get('size') || 'ALL';
        const urlSort = searchParams.get('sort') || 'NEWEST';
        const urlPage = Number(searchParams.get('page')) || 0;
        if (urlSearch !== search) setSearch(urlSearch);
        if (urlCategory !== categoryFilter) setCategoryFilter(urlCategory as 'ALL' | StoreProductCategory);
        if (urlPriceMin !== priceMin) setPriceMin(urlPriceMin);
        if (urlPriceMax !== priceMax) setPriceMax(urlPriceMax);
        if (urlSize !== size) setSize(urlSize);
        if (urlSort !== sort) setSort(urlSort as StoreSort);
        if (urlPage !== page) setPage(urlPage);
        if (urlRegion.country !== region.country || urlRegion.city !== region.city || urlRegion.clubId !== region.clubId) setRegion(urlRegion);
        // State-to-URL synchronization below prevents loops after these updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (search.trim()) next.set('search', search.trim());
        if (categoryFilter !== 'ALL') next.set('category', categoryFilter);
        if (region.country) next.set('country', region.country);
        if (region.city) next.set('city', region.city);
        if (region.clubId != null) next.set('clubId', String(region.clubId));
        if (priceMin > 0) next.set('priceMin', String(priceMin));
        if (priceMax > 0 && catalogPriceMax > 0 && priceMax < catalogPriceMax) next.set('priceMax', String(priceMax));
        if (size !== 'ALL') next.set('size', size);
        if (sort !== 'NEWEST') next.set('sort', sort);
        if (page > 0) next.set('page', String(page));
        setSearchParams(next, { replace: true });
    }, [categoryFilter, catalogPriceMax, page, priceMax, priceMin, region, search, setSearchParams, size, sort]);

    useEffect(() => {
        if (!mobileFiltersOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileFiltersOpen(false); };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
        return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKeyDown); };
    }, [mobileFiltersOpen]);

    useEffect(() => {
        if (mobileFiltersOpen) mobileFilterCloseRef.current?.focus();
        else if (hadMobileFiltersOpen.current) mobileFilterTriggerRef.current?.focus();
        hadMobileFiltersOpen.current = mobileFiltersOpen;
    }, [mobileFiltersOpen]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const next = products.filter((product) => {
            if (product.active === false) return false;
            if (categoryFilter !== 'ALL' && product.category !== categoryFilter) return false;
            if ((priceMin > 0 || (effectivePriceMax > 0 && effectivePriceMax < catalogPriceMax)) && (product.price == null || product.price < priceMin || product.price > effectivePriceMax)) return false;
            if (size !== 'ALL' && !(product.sizes ?? []).includes(size)) return false;
            if (region.country && product.clubCountryName !== region.country) return false;
            if (region.city && product.clubCityName !== region.city) return false;
            if (region.clubId != null && product.clubId !== region.clubId) return false;
            if (query) {
                const haystack = `${product.name ?? ''} ${product.description ?? ''} ${product.clubName ?? ''}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });
        return [...next].sort((a, b) => {
            if (sort === 'PRICE_LOW') return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
            if (sort === 'PRICE_HIGH') return (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY);
            return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        });
    }, [categoryFilter, catalogPriceMax, effectivePriceMax, priceMin, products, region, search, size, sort]);

    useEffect(() => { if (page > 0 && page >= Math.ceil(filtered.length / pageSize)) setPage(0); }, [filtered.length, page, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    const hasActiveFilters = Boolean(search.trim() || categoryFilter !== 'ALL' || priceMin > 0 || (effectivePriceMax > 0 && effectivePriceMax < catalogPriceMax) || size !== 'ALL' || region.country || region.city || region.clubId != null);

    const clearFilters = () => {
        setSearch('');
        setCategoryFilter('ALL');
        setRegion(EMPTY_CLUB_REGION);
        setPriceMin(0);
        setPriceMax(0);
        setSize('ALL');
        setSort('NEWEST');
        setPage(0);
    };

    const activeFilterChips: DirectoryFilterChip[] = [
        ...(search.trim() ? [{ id: 'search', label: `“${search.trim()}”` }] : []),
        ...(categoryFilter !== 'ALL' ? [{ id: 'category', label: formatCategory(categoryFilter) }] : []),
        ...(priceMin > 0 || (effectivePriceMax > 0 && effectivePriceMax < catalogPriceMax) ? [{ id: 'price', label: `${priceMin}–${effectivePriceMax} ₾` }] : []),
        ...(size !== 'ALL' ? [{ id: 'size', label: `Size ${size}` }] : []),
        ...(region.country ? [{ id: 'country', label: region.country }] : []),
        ...(region.city ? [{ id: 'city', label: region.city }] : []),
        ...(region.clubId != null ? [{ id: 'club', label: 'Club selected' }] : [])
    ];

    const removeFilter = (id: string) => {
        if (id === 'search') setSearch('');
        if (id === 'category') setCategoryFilter('ALL');
        if (id === 'price') { setPriceMin(0); setPriceMax(0); }
        if (id === 'size') setSize('ALL');
        if (id === 'country') setRegion(EMPTY_CLUB_REGION);
        if (id === 'city') setRegion((current) => ({ ...current, city: null, clubId: null }));
        if (id === 'club') setRegion((current) => ({ ...current, clubId: null }));
        setPage(0);
    };

    const renderFilters = (variant: 'rail' | 'drawer') => (
        <DirectoryFilterShell title="Filter store" description="Browse merchandise by product, price, size and club." accent="amber" variant={variant} hasActiveFilters={hasActiveFilters} clearLabel="Clear all" onClear={clearFilters}>
            <div className="space-y-5 p-4">
                <DirectoryFilterSection title="Product category" className="px-0 py-0">
                    <DirectoryChoiceList options={[{ value: 'ALL', label: 'All products' }, ...STORE_CATEGORIES.map((value) => ({ value, label: formatCategory(value) }))]} selectedValues={[categoryFilter]} onToggle={(value) => { setCategoryFilter(value as 'ALL' | StoreProductCategory); setPage(0); }} accent="amber" variant="pill" />
                </DirectoryFilterSection>
                {catalogPriceMax > 0 && <DirectoryFilterSection title="Price range" separated className="px-0 py-0"><DirectoryRangeFilter min={0} max={catalogPriceMax} lowerValue={priceMin} upperValue={effectivePriceMax} step={1} lowerLabel="Minimum" upperLabel="Maximum" valueFormatter={(value) => `${value} ₾`} accent="amber" onChange={(lower, upper) => { setPriceMin(lower); setPriceMax(upper >= catalogPriceMax ? 0 : upper); setPage(0); }} /></DirectoryFilterSection>}
                {Array.from(new Set(products.flatMap((product) => product.sizes ?? []))).length > 0 && <DirectoryFilterSection title="Size available" separated className="px-0 py-0"><DirectoryChoiceList options={[{ value: 'ALL', label: 'Any size' }, ...Array.from(new Set(products.flatMap((product) => product.sizes ?? []))).sort().map((value) => ({ value, label: value }))]} selectedValues={[size]} onToggle={(value) => { setSize(value); setPage(0); }} accent="amber" variant="pill" /></DirectoryFilterSection>}
                <DirectoryFilterSection title="Location and club" separated className="px-0 py-0"><ClubLocationFilter items={products.flatMap((product) => product.clubId == null ? [] : [{ clubId: product.clubId, clubName: product.clubName ?? 'Club', cityName: product.clubCityName, countryName: product.clubCountryName }])} value={region} onChange={(value) => { setRegion(value); setPage(0); }} label="Filter by club" defaultOpen className="border-0 bg-transparent p-0 shadow-none" /></DirectoryFilterSection>
            </div>
        </DirectoryFilterShell>
    );

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-[#0f1117] text-[color:var(--text-primary)]">
            <DiscoverySectionTabs />
            <header className="border-b border-[color:var(--theme-border)] pb-6 pt-1">
                <h1 className="text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">{t('store.title')}</h1>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{t('store.subtitle')}</p>
                <DirectoryToolbar search={search} searchLabel={t('store.search')} searchPlaceholder={t('store.search')} resultCount={!loading && !error ? filtered.length : undefined} resultLabel={(count) => `${count} ${count === 1 ? 'product' : 'products'}`} sort={sort} sortLabel="Sort products" sortOptions={SORT_OPTIONS} hasActiveFilters={hasActiveFilters} filtersOpen={mobileFiltersOpen} filterLabel="Filters" activeFilterChips={activeFilterChips} filterButtonRef={mobileFilterTriggerRef} accent="amber" onSearchChange={(value) => { setSearch(value); setPage(0); }} onSortChange={(value) => { setSort(value as StoreSort); setPage(0); }} onClearFilters={clearFilters} onRemoveFilter={removeFilter} onOpenFilters={() => setMobileFiltersOpen(true)} />
            </header>

            <div className="grid gap-5 py-5 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
                <aside aria-label="Store filters" className="hidden xl:block">{renderFilters('rail')}</aside>
                <main className="min-w-0">
                    {loading ? <PageSpinner /> : error ? <p className="py-10 text-center text-sm text-[#d4737a]">{error}</p> : filtered.length === 0 ? <EmptyStateCard icon={ShoppingBag} title={t('store.emptyTitle')} description={t('store.emptyDescription')} actionLabel={t('store.emptyCta')} actionIcon={Building2} onAction={() => navigate('/clubs')} /> : <><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((product) => <ProductCard key={product.id} product={product} onOpen={setSelected} showClub />)}</div><PaginationBar page={page} totalPages={totalPages} totalElements={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(0); }} /></>}
                </main>
            </div>

            <DirectoryFilterDrawer open={mobileFiltersOpen} title="Store filters" closeLabel="Close filters" closeRef={mobileFilterCloseRef} onClose={() => setMobileFiltersOpen(false)}>{renderFilters('drawer')}</DirectoryFilterDrawer>
            <ProductQuickViewModal product={selected} onClose={() => setSelected(null)} />
        </div>
    );
};
