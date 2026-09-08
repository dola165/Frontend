import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Building2, CalendarClock, HeartHandshake, Loader2, MapPin } from 'lucide-react';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { ClubLocationFilter } from '../components/discovery/ClubLocationFilter';
import { EMPTY_CLUB_REGION, type ClubRegionSelection } from '../components/discovery/clubLocationTypes';
import { DirectoryChoiceList, DirectoryFilterSection, DirectoryFilterShell, type DirectoryFilterChip } from '../components/discovery/DirectoryFilterShell';
import { DirectoryFilterDrawer } from '../components/discovery/DirectoryFilterDrawer';
import { DirectoryToolbar, type DirectorySortOption } from '../components/discovery/DirectoryToolbar';
import { fetchOpenJobDirectory, type ClubJob, type ClubJobCategory, type ClubJobEngagementType } from '../features/clubs/api';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

type PostedWindow = 'ALL' | '7D' | '30D';
type JobSort = 'NEWEST' | 'OLDEST';

const CATEGORIES: Array<{ value: 'ALL' | ClubJobCategory; label: string }> = [
    { value: 'ALL', label: 'All football roles' },
    { value: 'COACHING', label: 'Coaching' },
    { value: 'FOOTBALL_OPERATIONS', label: 'Football operations' },
    { value: 'ADMINISTRATION', label: 'Administration' },
    { value: 'MEDIA_COMMUNICATIONS', label: 'Media & communications' },
    { value: 'FACILITIES', label: 'Facilities & maintenance' },
    { value: 'MEDICAL', label: 'Medical & wellbeing' },
    { value: 'MATCHDAY', label: 'Matchday staff' },
    { value: 'OTHER', label: 'Other club roles' }
];

const ENGAGEMENTS: Array<{ value: 'ALL' | ClubJobEngagementType; label: string }> = [
    { value: 'ALL', label: 'Paid and volunteer' },
    { value: 'PAID', label: 'Paid roles' },
    { value: 'VOLUNTEER', label: 'Volunteering' },
    { value: 'FLEXIBLE', label: 'Paid or volunteer' },
    { value: 'UNSPECIFIED', label: 'Not specified' }
];

const POSTED_OPTIONS = [
    { value: 'ALL', label: 'Any posting date' },
    { value: '7D', label: 'Past 7 days' },
    { value: '30D', label: 'Past 30 days' }
] as const;

const SORT_OPTIONS: readonly DirectorySortOption[] = [
    { value: 'NEWEST', label: 'Most recent' },
    { value: 'OLDEST', label: 'Oldest first' }
];

const labelForCategory = (value?: string | null) => CATEGORIES.find((item) => item.value === value)?.label ?? 'Other club role';
const labelForEngagement = (value?: string | null) => ENGAGEMENTS.find((item) => item.value === value)?.label ?? 'Not specified';
const locationLabel = (job: ClubJob) => [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ') || 'Location not specified';

const relativeDate = (value?: string | null) => {
    if (!value) return 'Recently posted';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    if (days === 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    return `Posted ${days} days ago`;
};

const readRegion = (params: URLSearchParams): ClubRegionSelection => ({
    country: params.get('country') || null,
    city: params.get('city') || null,
    clubId: params.get('clubId') ? Number(params.get('clubId')) : null
});

export const JobsDirectoryPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [category, setCategory] = useState<'ALL' | ClubJobCategory>((searchParams.get('category') as ClubJobCategory | null) ?? 'ALL');
    const [engagement, setEngagement] = useState<'ALL' | ClubJobEngagementType>((searchParams.get('engagement') as ClubJobEngagementType | null) ?? 'ALL');
    const [posted, setPosted] = useState<PostedWindow>((searchParams.get('posted') as PostedWindow | null) ?? 'ALL');
    const [ageGroup, setAgeGroup] = useState(searchParams.get('ageGroup') || 'ALL');
    const [level, setLevel] = useState(searchParams.get('level') || 'ALL');
    const [sort, setSort] = useState<JobSort>((searchParams.get('sort') as JobSort | null) ?? 'NEWEST');
    const [region, setRegion] = useState<ClubRegionSelection>(() => readRegion(searchParams));
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const mobileFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileFilterCloseRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileFiltersOpen = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchOpenJobDirectory();
            setJobs(result);
            setSelectedId((current) => current != null && result.some((job) => job.id === current) ? current : result[0]?.id ?? null);
        } catch {
            setJobs([]);
            setError('Could not load club opportunities. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Keep local controls aligned with browser back/forward navigation.
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlCategory = searchParams.get('category') || 'ALL';
        const urlEngagement = searchParams.get('engagement') || 'ALL';
        const urlPosted = searchParams.get('posted') || 'ALL';
        const urlAgeGroup = searchParams.get('ageGroup') || 'ALL';
        const urlLevel = searchParams.get('level') || 'ALL';
        const urlSort = searchParams.get('sort') || 'NEWEST';
        const urlRegion = readRegion(searchParams);
        if (urlSearch !== search) setSearch(urlSearch);
        if (urlCategory !== category) setCategory(urlCategory as 'ALL' | ClubJobCategory);
        if (urlEngagement !== engagement) setEngagement(urlEngagement as 'ALL' | ClubJobEngagementType);
        if (urlPosted !== posted) setPosted(urlPosted as PostedWindow);
        if (urlAgeGroup !== ageGroup) setAgeGroup(urlAgeGroup);
        if (urlLevel !== level) setLevel(urlLevel);
        if (urlSort !== sort) setSort(urlSort as JobSort);
        if (urlRegion.country !== region.country || urlRegion.city !== region.city || urlRegion.clubId !== region.clubId) setRegion(urlRegion);
        // State-to-URL synchronization below prevents loops after these updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (search.trim()) next.set('search', search.trim());
        if (category !== 'ALL') next.set('category', category);
        if (engagement !== 'ALL') next.set('engagement', engagement);
        if (posted !== 'ALL') next.set('posted', posted);
        if (ageGroup !== 'ALL') next.set('ageGroup', ageGroup);
        if (level !== 'ALL') next.set('level', level);
        if (sort !== 'NEWEST') next.set('sort', sort);
        if (region.country) next.set('country', region.country);
        if (region.city) next.set('city', region.city);
        if (region.clubId != null) next.set('clubId', String(region.clubId));
        setSearchParams(next, { replace: true });
    }, [ageGroup, category, engagement, level, posted, region, search, setSearchParams, sort]);

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

    const locationItems = useMemo(() => jobs.flatMap((job) => job.clubId == null ? [] : [{ clubId: job.clubId, clubName: job.clubName ?? 'Club', cityName: job.clubCityName, countryName: job.clubCountryName }]), [jobs]);
    const ageOptions = useMemo(() => Array.from(new Set(jobs.map((job) => job.ageGroup).filter((value): value is string => Boolean(value)))).sort(), [jobs]);
    const levelOptions = useMemo(() => Array.from(new Set(jobs.map((job) => job.level).filter((value): value is string => Boolean(value)))).sort(), [jobs]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const now = Date.now();
        const next = jobs.filter((job) => {
            if (category !== 'ALL' && job.category !== category) return false;
            if (engagement !== 'ALL' && (job.engagementType ?? 'UNSPECIFIED') !== engagement) return false;
            if (posted !== 'ALL') {
                if (!job.createdAt) return false;
                const createdAt = new Date(job.createdAt).getTime();
                if (Number.isNaN(createdAt) || now - createdAt > (posted === '7D' ? 7 : 30) * 86_400_000) return false;
            }
            if (ageGroup !== 'ALL' && job.ageGroup !== ageGroup) return false;
            if (level !== 'ALL' && job.level !== level) return false;
            if (region.country && job.clubCountryName !== region.country) return false;
            if (region.city && job.clubCityName !== region.city) return false;
            if (region.clubId != null && job.clubId !== region.clubId) return false;
            if (query) {
                const haystack = `${job.title} ${job.description ?? ''} ${job.clubName ?? ''} ${labelForCategory(job.category)}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });
        return [...next].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return sort === 'OLDEST' ? aTime - bTime : bTime - aTime;
        });
    }, [ageGroup, category, engagement, jobs, level, posted, region, search, sort]);

    const selected = filtered.find((job) => job.id === selectedId) ?? filtered[0] ?? null;
    const hasFilters = Boolean(search.trim() || category !== 'ALL' || engagement !== 'ALL' || posted !== 'ALL' || ageGroup !== 'ALL' || level !== 'ALL' || region.country || region.city || region.clubId != null);

    const clearFilters = () => {
        setSearch('');
        setCategory('ALL');
        setEngagement('ALL');
        setPosted('ALL');
        setAgeGroup('ALL');
        setLevel('ALL');
        setSort('NEWEST');
        setRegion(EMPTY_CLUB_REGION);
    };

    const activeFilterChips: DirectoryFilterChip[] = [
        ...(search.trim() ? [{ id: 'search', label: `“${search.trim()}”` }] : []),
        ...(category !== 'ALL' ? [{ id: 'category', label: labelForCategory(category) }] : []),
        ...(engagement !== 'ALL' ? [{ id: 'engagement', label: labelForEngagement(engagement) }] : []),
        ...(posted !== 'ALL' ? [{ id: 'posted', label: POSTED_OPTIONS.find((option) => option.value === posted)?.label ?? posted }] : []),
        ...(ageGroup !== 'ALL' ? [{ id: 'ageGroup', label: ageGroup }] : []),
        ...(level !== 'ALL' ? [{ id: 'level', label: level }] : []),
        ...(region.country ? [{ id: 'country', label: region.country }] : []),
        ...(region.city ? [{ id: 'city', label: region.city }] : []),
        ...(region.clubId != null ? [{ id: 'club', label: 'Club selected' }] : [])
    ];

    const removeFilter = (id: string) => {
        if (id === 'search') setSearch('');
        if (id === 'category') setCategory('ALL');
        if (id === 'engagement') setEngagement('ALL');
        if (id === 'posted') setPosted('ALL');
        if (id === 'ageGroup') setAgeGroup('ALL');
        if (id === 'level') setLevel('ALL');
        if (id === 'country') setRegion(EMPTY_CLUB_REGION);
        if (id === 'city') setRegion((current) => ({ ...current, city: null, clubId: null }));
        if (id === 'club') setRegion((current) => ({ ...current, clubId: null }));
    };

    const renderFilters = (variant: 'rail' | 'drawer') => (
        <DirectoryFilterShell title="Filter jobs" description="Narrow the directory by role, opportunity type, date and location." accent="violet" variant={variant} hasActiveFilters={hasFilters} clearLabel="Clear all" onClear={clearFilters}>
            <div className="space-y-5 p-4">
                <DirectoryFilterSection title="Football role" className="px-0 py-0"><DirectoryChoiceList options={CATEGORIES} selectedValues={[category]} onToggle={(value) => setCategory(value as 'ALL' | ClubJobCategory)} accent="violet" variant="row" /></DirectoryFilterSection>
                <DirectoryFilterSection title="Payment and engagement" separated className="px-0 py-0"><DirectoryChoiceList options={ENGAGEMENTS} selectedValues={[engagement]} onToggle={(value) => setEngagement(value as 'ALL' | ClubJobEngagementType)} accent="violet" variant="row" /></DirectoryFilterSection>
                <DirectoryFilterSection title="Posted" separated className="px-0 py-0"><DirectoryChoiceList options={POSTED_OPTIONS} selectedValues={[posted]} onToggle={(value) => setPosted(value as PostedWindow)} accent="violet" variant="pill" /></DirectoryFilterSection>
                {ageOptions.length > 0 && <DirectoryFilterSection title="Age group" separated className="px-0 py-0"><DirectoryChoiceList options={[{ value: 'ALL', label: 'Any age group' }, ...ageOptions.map((value) => ({ value, label: value }))]} selectedValues={[ageGroup]} onToggle={setAgeGroup} accent="violet" variant="pill" /></DirectoryFilterSection>}
                {levelOptions.length > 0 && <DirectoryFilterSection title="Level" separated className="px-0 py-0"><DirectoryChoiceList options={[{ value: 'ALL', label: 'Any level' }, ...levelOptions.map((value) => ({ value, label: value }))]} selectedValues={[level]} onToggle={setLevel} accent="violet" variant="pill" /></DirectoryFilterSection>}
                <DirectoryFilterSection title="Location and club" separated className="px-0 py-0"><ClubLocationFilter items={locationItems} value={region} onChange={setRegion} label="Location and club" defaultOpen className="border-0 bg-transparent p-0 shadow-none" /></DirectoryFilterSection>
            </div>
        </DirectoryFilterShell>
    );

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-transparent text-[color:var(--text-primary)]">
            <DiscoverySectionTabs />
            <header className="border-b border-[color:var(--theme-border)] pb-6 pt-1">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-300">Work in football</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Jobs & volunteer opportunities</h1><p className="mt-1 max-w-2xl text-sm text-[color:var(--text-secondary)]">Real openings published by clubs through their GrassKickZ workspace.</p></div>
                </div>
                <DirectoryToolbar search={search} searchLabel="Search jobs" searchPlaceholder="Job title, club or skill" resultCount={!loading && !error ? filtered.length : undefined} resultLabel={(count) => `${count} ${count === 1 ? 'opportunity' : 'opportunities'}`} sort={sort} sortLabel="Sort opportunities" sortOptions={SORT_OPTIONS} hasActiveFilters={hasFilters} filtersOpen={mobileFiltersOpen} filterLabel="Filters" activeFilterChips={activeFilterChips} filterButtonRef={mobileFilterTriggerRef} accent="violet" onSearchChange={setSearch} onSortChange={(value) => setSort(value as JobSort)} onClearFilters={clearFilters} onRemoveFilter={removeFilter} onOpenFilters={() => setMobileFiltersOpen(true)} />
            </header>

            <div className="grid gap-5 py-5 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_350px]">
                <aside aria-label="Job filters" className="hidden xl:block">{renderFilters('rail')}</aside>
                <main className="min-w-0">
                    {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-fuchsia-300" /></div> : error ? <div className="flex min-h-72 flex-col items-center justify-center border-y border-white/[0.08] text-center"><p className="text-sm text-rose-300">{error}</p><button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold text-fuchsia-200">Try again</button></div> : filtered.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center border-y border-white/[0.08] text-center"><BriefcaseBusiness className="h-7 w-7 text-[#71717a]" /><h2 className="mt-3 text-base font-bold">No roles match these filters</h2><p className="mt-1 text-sm text-[#8b8d94]">Try another location, role or opportunity type.</p></div> : <div className="divide-y divide-[color:var(--theme-border)] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]">{filtered.map((job) => { const active = selected?.id === job.id; const logo = resolveMediaUrl(job.clubLogoUrl); return <button key={job.id} type="button" onClick={() => setSelectedId(job.id)} className={`group flex w-full gap-4 px-4 py-4 text-left transition-colors ${active ? 'bg-fuchsia-400/10' : 'hover:bg-[color:var(--theme-surface-inset)]'}`}><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-strong)]">{logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-[#8b8d94]" />}</span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-bold group-hover:text-fuchsia-200">{job.title}</span><span className="mt-0.5 block text-xs font-semibold text-[color:var(--text-secondary)]">{job.clubName ?? 'Football club'}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#52525b] group-hover:text-fuchsia-200" /></span><span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--text-secondary)]"><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{locationLabel(job)}</span><span className="inline-flex items-center gap-1">{job.engagementType === 'VOLUNTEER' ? <HeartHandshake className="h-3 w-3" /> : <BriefcaseBusiness className="h-3 w-3" />}{labelForEngagement(job.engagementType)}</span><span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{relativeDate(job.createdAt)}</span></span><span className="mt-2 block text-xs text-[color:var(--text-secondary)]">{labelForCategory(job.category)}{job.ageGroup ? ` · ${job.ageGroup}` : ''}{job.level ? ` · ${job.level.toLowerCase()}` : ''}</span></span></button>; })}</div>}
                </main>
                <aside className="hidden 2xl:block">{selected && <div className="sticky top-[calc(var(--app-header-height)+20px)] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]"><div className="border-b border-[color:var(--theme-border)] px-5 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fuchsia-200">Selected opportunity</p><h2 className="mt-2 text-xl font-bold leading-tight">{selected.title}</h2><p className="mt-2 text-sm font-semibold">{selected.clubName ?? 'Football club'}</p><p className="mt-1 text-xs text-[color:var(--text-secondary)]">{locationLabel(selected)}</p></div><div className="px-5 py-5"><div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--text-secondary)]"><span className="border border-[color:var(--theme-border)] px-2 py-1">{labelForCategory(selected.category)}</span><span className="border border-[color:var(--theme-border)] px-2 py-1">{labelForEngagement(selected.engagementType)}</span></div><p className="mt-5 whitespace-pre-line text-sm leading-6 text-[color:var(--text-secondary)]">{selected.description || 'The club has not added a full description yet.'}</p>{selected.clubId != null && <Link to={`/clubs/${selected.clubId}`} className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 text-xs font-bold text-white transition-colors hover:bg-fuchsia-500">View club and opportunity <ArrowRight className="h-3.5 w-3.5" /></Link>}</div></div>}</aside>
            </div>

            <DirectoryFilterDrawer open={mobileFiltersOpen} title="Job filters" closeLabel="Close filters" closeRef={mobileFilterCloseRef} onClose={() => setMobileFiltersOpen(false)}>{renderFilters('drawer')}</DirectoryFilterDrawer>
        </div>
    );
};
