import { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, HeartHandshake } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { ClubLocationFilter } from '../components/discovery/ClubLocationFilter';
import { EMPTY_CLUB_REGION, type ClubLocationItem, type ClubRegionSelection } from '../components/discovery/clubLocationTypes';
import { DirectoryChoiceList, DirectoryFilterSection, DirectoryFilterShell, type DirectoryFilterChip } from '../components/discovery/DirectoryFilterShell';
import { DirectoryFilterDrawer } from '../components/discovery/DirectoryFilterDrawer';
import { DirectoryToolbar } from '../components/discovery/DirectoryToolbar';
import { fetchClubLocationOptions } from '../features/discovery/api';

interface OpportunityDirectoryPageProps {
    type: 'jobs' | 'campaigns';
}

const CAMPAIGN_OPTIONS = [
    { value: 'ALL', label: 'All campaigns' },
    { value: 'FUNDRAISING', label: 'Fundraising' },
    { value: 'GRASSROOTS', label: 'Grassroots' },
    { value: 'COMMUNITY', label: 'Community' }
] as const;

const copy = {
    jobs: {
        eyebrow: 'Football opportunities',
        title: 'Jobs',
        subtitle: 'Coaching, staff and volunteer roles from clubs in one searchable directory.',
        search: 'Search roles, clubs or skills',
        Icon: BriefcaseBusiness
    },
    campaigns: {
        eyebrow: 'Club and grassroots support',
        title: 'Campaigns',
        subtitle: 'Fundraisers and community campaigns presented with the same familiar discovery layout.',
        search: 'Search campaigns or clubs',
        Icon: HeartHandshake
    }
} as const;

const readRegion = (params: URLSearchParams): ClubRegionSelection => ({
    country: params.get('country') || null,
    city: params.get('city') || null,
    clubId: params.get('clubId') ? Number(params.get('clubId')) : null
});

export const OpportunityDirectoryPage = ({ type }: OpportunityDirectoryPageProps) => {
    const page = copy[type];
    const Icon = page.Icon;
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [category, setCategory] = useState(searchParams.get('category') || 'ALL');
    const [clubs, setClubs] = useState<ClubLocationItem[]>([]);
    const [region, setRegion] = useState<ClubRegionSelection>(() => readRegion(searchParams));
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const mobileFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileFilterCloseRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileFiltersOpen = useRef(false);

    useEffect(() => { void fetchClubLocationOptions().then(setClubs).catch(() => setClubs([])); }, []);

    // Keep local controls aligned with browser back/forward navigation.
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlCategory = searchParams.get('category') || 'ALL';
        const urlRegion = readRegion(searchParams);
        if (urlSearch !== search) setSearch(urlSearch);
        if (urlCategory !== category) setCategory(urlCategory);
        if (urlRegion.country !== region.country || urlRegion.city !== region.city || urlRegion.clubId !== region.clubId) setRegion(urlRegion);
        // State-to-URL synchronization below prevents loops after these updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (search.trim()) next.set('search', search.trim());
        if (category !== 'ALL') next.set('category', category);
        if (region.country) next.set('country', region.country);
        if (region.city) next.set('city', region.city);
        if (region.clubId != null) next.set('clubId', String(region.clubId));
        setSearchParams(next, { replace: true });
    }, [category, region, search, setSearchParams]);

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

    const filtersActive = Boolean(search.trim() || category !== 'ALL' || region.country || region.city || region.clubId != null);

    const clearFilters = () => {
        setSearch('');
        setCategory('ALL');
        setRegion(EMPTY_CLUB_REGION);
    };

    const activeFilterChips: DirectoryFilterChip[] = [
        ...(search.trim() ? [{ id: 'search', label: `“${search.trim()}”` }] : []),
        ...(category !== 'ALL' ? [{ id: 'category', label: CAMPAIGN_OPTIONS.find((option) => option.value === category)?.label ?? category }] : []),
        ...(region.country ? [{ id: 'country', label: region.country }] : []),
        ...(region.city ? [{ id: 'city', label: region.city }] : []),
        ...(region.clubId != null ? [{ id: 'club', label: 'Club selected' }] : [])
    ];

    const removeFilter = (id: string) => {
        if (id === 'search') setSearch('');
        if (id === 'category') setCategory('ALL');
        if (id === 'country') setRegion(EMPTY_CLUB_REGION);
        if (id === 'city') setRegion((current) => ({ ...current, city: null, clubId: null }));
        if (id === 'club') setRegion((current) => ({ ...current, clubId: null }));
    };

    const renderFilters = (variant: 'rail' | 'drawer') => (
        <DirectoryFilterShell title="Filter campaigns" description="Choose a campaign type, country, city or club." accent="emerald" variant={variant} hasActiveFilters={filtersActive} clearLabel="Clear all" onClear={clearFilters}>
            <div className="space-y-5 p-4">
                <DirectoryFilterSection title="Campaign purpose" className="px-0 py-0"><DirectoryChoiceList options={CAMPAIGN_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} selectedValues={[category]} onToggle={setCategory} accent="emerald" variant="row" /></DirectoryFilterSection>
                <DirectoryFilterSection title="Location and club" separated className="px-0 py-0"><ClubLocationFilter items={clubs} value={region} onChange={setRegion} label="Location and club" defaultOpen className="border-0 bg-transparent p-0 shadow-none" /></DirectoryFilterSection>
            </div>
        </DirectoryFilterShell>
    );

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-transparent text-[color:var(--text-primary)]">
            <DiscoverySectionTabs />
            <header className="border-b border-[color:var(--theme-border)] pb-6 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">{page.eyebrow}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">{page.title}</h1>
                <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-secondary)]">{page.subtitle}</p>
                <DirectoryToolbar search={search} searchLabel={page.search} searchPlaceholder={page.search} hasActiveFilters={filtersActive} filtersOpen={mobileFiltersOpen} filterLabel="Filters" activeFilterChips={activeFilterChips} filterButtonRef={mobileFilterTriggerRef} accent="emerald" onSearchChange={setSearch} onClearFilters={clearFilters} onRemoveFilter={removeFilter} onOpenFilters={() => setMobileFiltersOpen(true)} />
            </header>

            <div className="mt-5 grid gap-5 py-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside aria-label="Campaign filters" className="hidden xl:block">{renderFilters('rail')}</aside>
                <main className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] px-6 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--theme-surface-inset)]"><Icon className="h-6 w-6 text-emerald-400" /></span>
                    <h2 className="mt-4 text-base font-bold">{type === 'campaigns' ? 'The campaigns directory is ready for listings' : 'The jobs directory is ready for club listings'}</h2>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-[color:var(--text-secondary)]">{type === 'campaigns' ? 'Active campaigns will appear here as clubs publish them. This screen intentionally avoids invented campaign data.' : 'Open jobs will appear here as clubs publish them. The shared filters are ready for the next live listing.'}</p>
                    {type === 'campaigns' && <p className="mt-3 text-xs text-[color:var(--text-muted)]">Fundraiser data remains intentionally disconnected until the next product decision.</p>}
                </main>
            </div>

            <DirectoryFilterDrawer open={mobileFiltersOpen} title="Campaign filters" closeLabel="Close filters" closeRef={mobileFilterCloseRef} onClose={() => setMobileFiltersOpen(false)}>{renderFilters('drawer')}</DirectoryFilterDrawer>
        </div>
    );
};
