import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { PageSpinner } from '../components/workspace/helpers';
import { EmptyStateCard } from '../components/workspace/EmptyStateCard';
import { ProductCard } from '../components/store/ProductCard';
import { ProductQuickViewModal } from '../components/store/ProductQuickViewModal';
import { fetchClubStoreProducts, STORE_CATEGORIES } from '../features/store/api';
import type { StoreProduct, StoreProductCategory } from '../features/store/api';
import type { ClubProfile } from './ClubProfilePage';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

type CollectionId = 'ALL' | 'KIT' | 'TRAINING' | 'MATCHDAY' | 'SUPPORTER';
type SortMode = 'FEATURED' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC';

const COLLECTIONS: Array<{ id: Exclude<CollectionId, 'ALL'>; categories: StoreProductCategory[] }> = [
    { id: 'KIT', categories: ['SHIRT', 'FOOTWEAR'] },
    { id: 'TRAINING', categories: ['TRAINING', 'EQUIPMENT'] },
    { id: 'MATCHDAY', categories: ['TICKETS', 'EVENT'] },
    { id: 'SUPPORTER', categories: ['ACCESSORIES', 'MEMBERSHIP', 'OTHER'] }
];

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
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<'ALL' | StoreProductCategory>('ALL');
    const [collection, setCollection] = useState<CollectionId>('ALL');
    const [sort, setSort] = useState<SortMode>('FEATURED');

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
            setError(t('store.clubLoadFailed'));
        } finally {
            setLoading(false);
        }
    }, [clubId, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const availableCategories = useMemo(
        () => STORE_CATEGORIES.filter((candidate) => products.some((product) => product.category === candidate)),
        [products]
    );
    const availableCollections = useMemo(
        () => COLLECTIONS.filter((candidate) => products.some((product) => product.category && candidate.categories.includes(product.category))),
        [products]
    );

    const visibleProducts = useMemo(() => {
        const query = search.trim().toLowerCase();
        const collectionCategories = collection === 'ALL' ? null : COLLECTIONS.find((candidate) => candidate.id === collection)?.categories;
        const filtered = products.filter((product) => {
            if (category !== 'ALL' && product.category !== category) return false;
            if (collectionCategories && (!product.category || !collectionCategories.includes(product.category))) return false;
            if (!query) return true;
            return `${product.name ?? ''} ${product.description ?? ''} ${product.category ?? ''}`.toLowerCase().includes(query);
        });
        return [...filtered].sort((a, b) => {
            if (sort === 'PRICE_ASC') return (a.price ?? 0) - (b.price ?? 0);
            if (sort === 'PRICE_DESC') return (b.price ?? 0) - (a.price ?? 0);
            if (sort === 'NEWEST') return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
            return 0;
        });
    }, [category, collection, products, search, sort]);

    const resetFilters = () => {
        setSearch('');
        setCategory('ALL');
        setCollection('ALL');
        setSort('FEATURED');
    };
    const filtersActive = search.trim() !== '' || category !== 'ALL' || collection !== 'ALL' || sort !== 'FEATURED';

    return (
        <div className="club-page-shell min-h-[calc(100dvh-var(--app-header-height))] bg-[color:var(--club-theme-base)]">
            <div className="w-full py-1">
                <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                        <button onClick={() => navigate(`/clubs/${clubId}`)} className="shrink-0 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] p-2 text-[color:var(--club-theme-text-secondary)] transition-colors hover:text-[color:var(--club-theme-text-primary)]" aria-label={t('store.backToClub')}>
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        {club?.logoUrl ? (
                            <img src={resolveMediaUrl(club.logoUrl)} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                        ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)]"><ShoppingBag className="h-5 w-5 text-[color:var(--club-theme-text-muted)]" /></span>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[color:var(--club-theme-text-muted)]">{t('store.clubStoreEyebrow')}</p>
                            <h1 className="truncate text-xl font-semibold text-[color:var(--club-theme-text-primary)]">{club?.name ?? t('store.title')}</h1>
                            <p className="mt-1 text-xs text-[color:var(--club-theme-text-muted)] sm:whitespace-nowrap">{t('store.clubSubtitle')}</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/store')} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] px-4 py-2.5 text-xs font-semibold text-[color:var(--club-theme-text-primary)] transition-colors hover:border-[#16a34a]/50 hover:text-[#16a34a] sm:ml-auto sm:w-auto">
                        <ShoppingBag className="h-4 w-4" /> {t('store.browseGlobal')} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </header>

                {!loading && !error && products.length > 0 && (
                    <div className="mb-6 space-y-4 border-y border-[color:var(--club-theme-border-subtle)] py-4">
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--club-theme-text-muted)]">{t('store.collections')}</h2>
                                <span className="text-[11px] text-[color:var(--club-theme-text-muted)]">{t('store.resultCount', { count: visibleProducts.length })}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => { setCollection('ALL'); setCategory('ALL'); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${collection === 'ALL' ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]' : 'border-[color:var(--club-theme-border-subtle)] text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)]'}`}>{t('store.allProducts')}</button>
                                {availableCollections.map((item) => (
                                    <button key={item.id} onClick={() => { setCollection(item.id); setCategory('ALL'); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${collection === item.id ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]' : 'border-[color:var(--club-theme-border-subtle)] text-[color:var(--club-theme-text-secondary)] hover:text-[color:var(--club-theme-text-primary)]'}`}>{t(`store.collectionNames.${item.id}`)}</button>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                            <label className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--club-theme-text-muted)]" />
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('store.searchClubProducts')} className="h-11 w-full rounded-xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] pl-10 pr-3 text-sm text-[color:var(--club-theme-text-primary)] outline-none placeholder:text-[color:var(--club-theme-text-muted)] focus:border-[#16a34a]" />
                            </label>
                            <label className="relative">
                                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--club-theme-text-muted)]" />
                                <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 w-full appearance-none rounded-xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)] pl-10 pr-3 text-sm text-[color:var(--club-theme-text-primary)] outline-none focus:border-[#16a34a]">
                                    <option value="FEATURED">{t('store.sortFeatured')}</option>
                                    <option value="NEWEST">{t('store.sortNewest')}</option>
                                    <option value="PRICE_ASC">{t('store.sortPriceLow')}</option>
                                    <option value="PRICE_DESC">{t('store.sortPriceHigh')}</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => setCategory('ALL')} className={`rounded-full px-3 py-1 text-xs font-semibold ${category === 'ALL' ? 'bg-[#16a34a] text-white' : 'bg-[color:var(--club-theme-surface)] text-[color:var(--club-theme-text-secondary)]'}`}>{t('store.allCategories')}</button>
                            {availableCategories.map((item) => <button key={item} onClick={() => { setCategory(item); setCollection('ALL'); }} className={`rounded-full px-3 py-1 text-xs font-semibold ${category === item ? 'bg-[#16a34a] text-white' : 'bg-[color:var(--club-theme-surface)] text-[color:var(--club-theme-text-secondary)]'}`}>{t(`store.categories.${item}`)}</button>)}
                            {filtersActive && <button onClick={resetFilters} className="ml-auto text-xs font-semibold text-[#16a34a] hover:underline">{t('store.resetFilters')}</button>}
                        </div>
                    </div>
                )}

                {loading ? <PageSpinner /> : error ? (
                    <p className="py-10 text-center text-sm text-[#d4737a]">{error}</p>
                ) : products.length === 0 ? (
                    <EmptyStateCard icon={ShoppingBag} title={t('store.clubEmptyTitle')} description={t('store.clubEmptyDescription')} actionLabel={t('store.browseGlobal')} onAction={() => navigate('/store')} />
                ) : visibleProducts.length === 0 ? (
                    <EmptyStateCard icon={Search} title={t('store.noFilteredProducts')} description={t('store.noFilteredProductsDescription')} actionLabel={t('store.resetFilters')} onAction={resetFilters} />
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleProducts.map((product) => <ProductCard key={product.id} product={product} onOpen={setSelected} />)}
                    </div>
                )}
            </div>
            <ProductQuickViewModal product={selected} onClose={() => setSelected(null)} />
        </div>
    );
};
