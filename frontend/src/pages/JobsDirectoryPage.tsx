import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    CalendarClock,
    HeartHandshake,
    Loader2,
    MapPin,
    Search,
    SlidersHorizontal,
} from 'lucide-react';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import {
    ClubLocationFilter,
} from '../components/discovery/ClubLocationFilter';
import { EMPTY_CLUB_REGION, type ClubRegionSelection } from '../components/discovery/clubLocationTypes';
import {
    fetchOpenJobDirectory,
    type ClubJob,
    type ClubJobCategory,
    type ClubJobEngagementType,
} from '../features/clubs/api';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const CATEGORIES: Array<{ value: 'ALL' | ClubJobCategory; label: string }> = [
    { value: 'ALL', label: 'All football roles' },
    { value: 'COACHING', label: 'Coaching' },
    { value: 'FOOTBALL_OPERATIONS', label: 'Football operations' },
    { value: 'ADMINISTRATION', label: 'Administration' },
    { value: 'MEDIA_COMMUNICATIONS', label: 'Media & communications' },
    { value: 'FACILITIES', label: 'Facilities & maintenance' },
    { value: 'MEDICAL', label: 'Medical & wellbeing' },
    { value: 'MATCHDAY', label: 'Matchday staff' },
    { value: 'OTHER', label: 'Other club roles' },
];

const ENGAGEMENTS: Array<{ value: 'ALL' | ClubJobEngagementType; label: string }> = [
    { value: 'ALL', label: 'Paid and volunteer' },
    { value: 'PAID', label: 'Paid roles' },
    { value: 'VOLUNTEER', label: 'Volunteering' },
    { value: 'FLEXIBLE', label: 'Paid or volunteer' },
    { value: 'UNSPECIFIED', label: 'Not specified' },
];

const labelForCategory = (value?: string | null) => CATEGORIES.find((item) => item.value === value)?.label ?? 'Other club role';
const labelForEngagement = (value?: string | null) => ENGAGEMENTS.find((item) => item.value === value)?.label ?? 'Not specified';

const relativeDate = (value?: string | null) => {
    if (!value) return 'Recently posted';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently posted';
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    if (days === 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    return `Posted ${days} days ago`;
};

const locationLabel = (job: ClubJob) => [job.clubCityName, job.clubCountryName].filter(Boolean).join(', ') || 'Location not specified';

export const JobsDirectoryPage = () => {
    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<'ALL' | ClubJobCategory>('ALL');
    const [engagement, setEngagement] = useState<'ALL' | ClubJobEngagementType>('ALL');
    const [region, setRegion] = useState<ClubRegionSelection>(EMPTY_CLUB_REGION);
    const [selectedId, setSelectedId] = useState<number | null>(null);

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

    const locationItems = useMemo(() => jobs.flatMap((job) => job.clubId == null ? [] : [{
        clubId: job.clubId,
        clubName: job.clubName ?? 'Club',
        cityName: job.clubCityName,
        countryName: job.clubCountryName,
    }]), [jobs]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return jobs.filter((job) => {
            if (category !== 'ALL' && job.category !== category) return false;
            if (engagement !== 'ALL' && (job.engagementType ?? 'UNSPECIFIED') !== engagement) return false;
            if (region.country && job.clubCountryName !== region.country) return false;
            if (region.city && job.clubCityName !== region.city) return false;
            if (region.clubId != null && job.clubId !== region.clubId) return false;
            if (query) {
                const haystack = `${job.title} ${job.description ?? ''} ${job.clubName ?? ''} ${labelForCategory(job.category)}`.toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });
    }, [category, engagement, jobs, region, search]);

    const selected = filtered.find((job) => job.id === selectedId) ?? filtered[0] ?? null;
    const hasFilters = Boolean(search.trim() || category !== 'ALL' || engagement !== 'ALL' || region.country || region.city || region.clubId);

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-transparent text-[color:var(--text-primary)]">
            <DiscoverySectionTabs />

            <header className="border-b border-[color:var(--theme-border)] pb-6 pt-1">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7dd3a8]">Work in football</p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">Jobs & volunteer opportunities</h1>
                        <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-secondary)]">Real openings published by clubs through their GrassKickZ workspace.</p>
                    </div>
                    <span className="rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)]">
                        {filtered.length} {filtered.length === 1 ? 'opportunity' : 'opportunities'}
                    </span>
                </div>

                <div className="mt-5">
                    <label className="relative block w-full">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                        <span className="sr-only">Search jobs</span>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Job title, club or skill"
                            className="h-12 w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] pl-12 pr-4 text-sm font-medium text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/15"
                        />
                    </label>
                </div>
            </header>

            <div className="grid gap-5 py-5 lg:grid-cols-[310px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)_350px]">
                <aside aria-label="Job filters" className="h-fit overflow-hidden rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] shadow-[var(--theme-shadow)] lg:sticky lg:top-[calc(var(--app-header-height)+20px)]">
                    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--theme-border)] bg-[#16a34a]/10 px-4 py-4">
                        <div>
                            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-primary)]"><SlidersHorizontal className="h-4 w-4 text-[#168a4b] dark:text-[#6ee7a0]" /> Filter jobs</span>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">Narrow the directory by football role, type and location.</p>
                        </div>
                        {hasFilters && <button type="button" onClick={() => { setSearch(''); setCategory('ALL'); setEngagement('ALL'); setRegion(EMPTY_CLUB_REGION); }} className="shrink-0 rounded-lg border border-[#16a34a]/25 px-2.5 py-1.5 text-xs font-bold text-[#168a4b] hover:bg-[#16a34a]/10 dark:text-[#6ee7a0]">Clear</button>}
                    </div>

                    <fieldset className="px-4 py-4">
                        <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">Football role</legend>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                            {CATEGORIES.map((item) => (
                                <label key={item.value} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${category === item.value ? 'border-[#16a34a]/45 bg-[#16a34a]/10 font-bold text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--theme-border)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]'}`}>
                                    <input type="radio" name="job-category" value={item.value} checked={category === item.value} onChange={() => setCategory(item.value)} className="sr-only" />
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${category === item.value ? 'border-[#16a34a]' : 'border-[color:var(--theme-border-strong)]'}`}>{category === item.value && <span className="h-2 w-2 rounded-full bg-[#16a34a]" />}</span>
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="border-t border-[color:var(--theme-border)] px-4 py-4">
                        <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">Opportunity type</legend>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                            {ENGAGEMENTS.map((item) => (
                                <label key={item.value} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${engagement === item.value ? 'border-[#16a34a]/45 bg-[#16a34a]/10 font-bold text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--theme-border)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]'}`}>
                                    <input type="radio" name="engagement" value={item.value} checked={engagement === item.value} onChange={() => setEngagement(item.value)} className="sr-only" />
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${engagement === item.value ? 'border-[#16a34a]' : 'border-[color:var(--theme-border-strong)]'}`}>{engagement === item.value && <span className="h-2 w-2 rounded-full bg-[#16a34a]" />}</span>
                                    {item.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="border-t border-[color:var(--theme-border)] p-3">
                        <ClubLocationFilter items={locationItems} value={region} onChange={setRegion} label="Location and club" defaultOpen />
                    </div>
                </aside>

                <main className="min-w-0">
                    {loading ? (
                        <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#22c55e]" /></div>
                    ) : error ? (
                        <div className="flex min-h-72 flex-col items-center justify-center border-y border-white/[0.08] text-center">
                            <p className="text-sm text-rose-300">{error}</p>
                            <button type="button" onClick={() => void load()} className="mt-3 text-xs font-semibold text-[#6ee7a0]">Try again</button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex min-h-72 flex-col items-center justify-center border-y border-white/[0.08] text-center">
                            <BriefcaseBusiness className="h-7 w-7 text-[#71717a]" />
                            <h2 className="mt-3 text-base font-bold text-white">No roles match these filters</h2>
                            <p className="mt-1 text-sm text-[#8b8d94]">Try another location, role or opportunity type.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[color:var(--theme-border)] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]">
                            {filtered.map((job) => {
                                const active = selected?.id === job.id;
                                const logo = resolveMediaUrl(job.clubLogoUrl);
                                return (
                                    <button
                                        key={job.id}
                                        type="button"
                                        onClick={() => setSelectedId(job.id)}
                                        className={`group flex w-full gap-4 px-4 py-4 text-left transition-colors ${active ? 'bg-[#16a34a]/10' : 'hover:bg-[color:var(--theme-surface-inset)]'}`}
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-strong)]">
                                            {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5 text-[#8b8d94]" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-3">
                                                <span>
                                                    <span className="block text-sm font-bold text-[color:var(--text-primary)] group-hover:text-[#168a4b] dark:group-hover:text-[#86efac]">{job.title}</span>
                                                    <span className="mt-0.5 block text-xs font-semibold text-[color:var(--text-secondary)]">{job.clubName ?? 'Football club'}</span>
                                                </span>
                                                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#52525b] group-hover:text-[#86efac]" />
                                            </span>
                                            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[color:var(--text-secondary)]">
                                                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{locationLabel(job)}</span>
                                                <span className="inline-flex items-center gap-1">{job.engagementType === 'VOLUNTEER' ? <HeartHandshake className="h-3 w-3" /> : <BriefcaseBusiness className="h-3 w-3" />}{labelForEngagement(job.engagementType)}</span>
                                                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />{relativeDate(job.createdAt)}</span>
                                            </span>
                                            <span className="mt-2 block text-xs text-[color:var(--text-secondary)]">{labelForCategory(job.category)}{job.ageGroup ? ` · ${job.ageGroup}` : ''}{job.level ? ` · ${job.level.toLowerCase()}` : ''}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </main>

                <aside className="hidden 2xl:block">
                    {selected && (
                        <div className="sticky top-[calc(var(--app-header-height)+20px)] overflow-hidden rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]">
                            <div className="border-b border-[color:var(--theme-border)] px-5 py-5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6ee7a0]">Selected opportunity</p>
                                <h2 className="mt-2 text-xl font-bold leading-tight text-[color:var(--text-primary)]">{selected.title}</h2>
                                <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{selected.clubName ?? 'Football club'}</p>
                                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{locationLabel(selected)}</p>
                            </div>
                            <div className="px-5 py-5">
                                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                                    <span className="border border-[color:var(--theme-border)] px-2 py-1">{labelForCategory(selected.category)}</span>
                                    <span className="border border-[color:var(--theme-border)] px-2 py-1">{labelForEngagement(selected.engagementType)}</span>
                                </div>
                                <p className="mt-5 whitespace-pre-line text-sm leading-6 text-[color:var(--text-secondary)]">{selected.description || 'The club has not added a full description yet.'}</p>
                                {selected.clubId != null && (
                                    <Link to={`/clubs/${selected.clubId}`} className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#168a4b] px-4 text-xs font-bold text-white transition-colors hover:bg-[#1d9b58]">
                                        View club and opportunity <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};
