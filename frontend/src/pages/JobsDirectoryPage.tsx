import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, Search, SlidersHorizontal, X, ArrowRight, Building2 } from 'lucide-react';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { fetchOpenJobDirectory, type ClubJob } from '../features/clubs/api';
import {
    CATEGORIES,
    ENGAGEMENTS,
    POSTED_OPTIONS,
    labelForCategory,
    labelForEngagement,
    locationLabel,
    relativeDate,
} from '../features/clubs/jobLabels';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';

const filterNames: Record<string, string> = {
    search: 'Search',
    category: 'Football role',
    engagement: 'Engagement',
    posted: 'Posted',
    ageGroup: 'Team age group',
    level: 'Experience',
    country: 'Country',
    city: 'City',
    clubId: 'Club',
};
const readChoice = (value: string | null, options: readonly { value: string }[]) =>
    options.some((o) => o.value === value) ? value! : 'ALL';
const timestamp = (value?: string | null) => {
    const n = Date.parse(value ?? '');
    return Number.isFinite(n) ? n : 0;
};

export const JobsDirectoryPage = ({ fixedClubId, clubName }: { fixedClubId?: number; clubName?: string }) => {
    const [params, setParams] = useSearchParams();
    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(''),
        [reload, setReload] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [asOf, setAsOf] = useState(() => Date.now());
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // Refresh from the source; old requests cannot replace a newer retry.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError('');
        setAsOf(Date.now());
        void fetchOpenJobDirectory(controller.signal)
            .then((data) => {
                if (active) setJobs(data);
            })
            .catch(() => {
                if (active) {
                    setJobs([]);
                    setError('Could not load opportunities. Please try again.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [reload]);
    const change = (key: string, value: string) =>
        setParams((current) => {
            const next = new URLSearchParams(current);
            if (value && value !== 'ALL') next.set(key, value);
            else next.delete(key);
            if (key !== 'page' && key !== 'job') next.delete('page');
            if (key !== 'job') next.delete('job');
            if (key === 'country') {
                next.delete('city');
                next.delete('clubId');
            }
            if (key === 'city') next.delete('clubId');
            return next;
        });
    const reset = () =>
        setParams((current) => {
            const next = new URLSearchParams(current);
            [...Object.keys(filterNames), 'page', 'sort', 'job'].forEach((key) => next.delete(key));
            return next;
        });
    const category = readChoice(params.get('category'), CATEGORIES),
        engagement = readChoice(params.get('engagement'), ENGAGEMENTS),
        posted = readChoice(params.get('posted'), POSTED_OPTIONS);
    const search = params.get('search') ?? '',
        country = params.get('country') ?? '',
        city = params.get('city') ?? '';
    const clubFilter = fixedClubId ?? (params.get('clubId') ? Number(params.get('clubId')) : undefined);
    const scope = fixedClubId ? jobs.filter((job) => job.clubId === fixedClubId) : jobs;
    const countries = [
        ...new Set(scope.map((job) => job.clubCountryName).filter((v): v is string => !!v)),
    ].sort();
    const cities = [
        ...new Set(
            scope
                .filter((job) => job.clubCountryName === country)
                .map((job) => job.clubCityName)
                .filter((v): v is string => !!v),
        ),
    ].sort();
    const clubs = [
        ...new Map(
            scope
                .filter(
                    (job) =>
                        (!country || job.clubCountryName === country) && (!city || job.clubCityName === city),
                )
                .map((job) => [job.clubId, job]),
        ).values(),
    ];
    const ageOptions = [...new Set(scope.map((job) => job.ageGroup).filter((v): v is string => !!v))].sort();
    const levels = [...new Set(scope.map((job) => job.level).filter((v): v is string => !!v))].sort();
    const filtered = scope
        .filter((job) => {
            if (category !== 'ALL' && job.category !== category) return false;
            if (engagement !== 'ALL' && (job.engagementType ?? 'UNSPECIFIED') !== engagement) return false;
            if (
                posted !== 'ALL' &&
                (!timestamp(job.createdAt) ||
                    asOf - timestamp(job.createdAt) > (posted === '7D' ? 7 : 30) * 86400000)
            )
                return false;
            if (params.get('ageGroup') && job.ageGroup !== params.get('ageGroup')) return false;
            if (params.get('level') && job.level !== params.get('level')) return false;
            if ((country && country !== job.clubCountryName) || (city && city !== job.clubCityName))
                return false;
            if (clubFilter !== undefined && job.clubId !== clubFilter) return false;
            return (
                !search.trim() ||
                `${job.title} ${job.description ?? ''} ${job.clubName ?? ''} ${labelForCategory(job.category)}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase())
            );
        })
        .sort((a, b) =>
            params.get('sort') === 'OLDEST'
                ? timestamp(a.createdAt) - timestamp(b.createdAt) || a.id - b.id
                : timestamp(b.createdAt) - timestamp(a.createdAt) || b.id - a.id,
        );
    const page = Math.min(
        Math.max(0, Math.floor(Number(params.get('page')) || 0)),
        Math.max(0, Math.ceil(filtered.length / 12) - 1),
    );
    const visible = filtered.slice(page * 12, page * 12 + 12);
    const selected = visible.find((job) => job.id === Number(params.get('job'))) ?? visible[0];
    const chips = Object.entries(filterNames).filter(
        ([key]) => !!params.get(key) && params.get(key) !== 'ALL',
    );
    const chipValue = (key: string) => {
        const value = params.get(key);
        if (key === 'category') return labelForCategory(value);
        if (key === 'engagement') return labelForEngagement(value);
        if (key === 'posted') return POSTED_OPTIONS.find((option) => option.value === value)?.label ?? value;
        if (key === 'clubId')
            return jobs.find((job) => job.clubId === Number(value))?.clubName ?? 'Unavailable club';
        return value;
    };
    const choices = (key: string, options: readonly { value: string; label: string }[], value: string) =>
        options.map((option) => (
            <button
                key={option.value}
                type="button"
                className="opportunity-choice"
                aria-pressed={value === option.value}
                onClick={() => change(key, option.value)}
            >
                <span aria-hidden="true" />
                {option.label}
            </button>
        ));
    const Surface = fixedClubId ? 'section' : 'main';
    return (
        <Surface className={`store-page jobs-page ${fixedClubId ? 'jobs-embedded' : ''}`}>
            {!fixedClubId && <DiscoverySectionTabs />}
            <header className="store-heading">
                <div>
                    <p className="store-eyebrow">Work in football</p>
                    <h1>
                        {fixedClubId
                            ? `${clubName ?? 'Club'} opportunities`
                            : 'Jobs & volunteer opportunities'}
                    </h1>
                    <p className="store-subtitle">
                        Find your place in football. Explore paid roles and volunteering.
                    </p>
                </div>
                <button
                    className="store-cart-link"
                    onClick={() => setReload((n) => n + 1)}
                    disabled={loading}
                >
                    Refresh
                </button>
            </header>
            {fixedClubId && <OpportunityNavigation section="jobs" clubId={fixedClubId}/>}
            <div className="store-toolbar">
                <label className="store-search">
                    <Search size={18} />
                    <span className="sr-only">Search jobs</span>
                    <input
                        maxLength={100}
                        value={search}
                        onChange={(e) => change('search', e.target.value)}
                        placeholder="Job title, club or skill"
                    />
                </label>
                <label className="store-sort">
                    Sort opportunities
                    <select
                        value={params.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST'}
                        onChange={(e) => change('sort', e.target.value)}
                    >
                        <option value="NEWEST">Most recent</option>
                        <option value="OLDEST">Oldest first</option>
                    </select>
                </label>
                <button
                    ref={trigger}
                    className="store-filter-toggle"
                    aria-expanded={filtersOpen}
                    aria-controls="job-filters"
                    onClick={() => setFiltersOpen((v) => !v)}
                >
                    <SlidersHorizontal size={16} />
                    {filtersOpen ? 'Hide filters' : 'Filters'}
                </button>
            </div>
            {!!chips.length && (
                <div className="store-filter-chips" aria-label="Selected job filters">
                    {chips.map(([key, label]) => (
                        <button
                            key={key}
                            aria-label={`Remove ${label} filter`}
                            onClick={() => change(key, '')}
                        >
                            {label}: {chipValue(key)}
                            <X size={13} />
                        </button>
                    ))}
                </div>
            )}
            <div className="store-catalog-layout">
                <aside
                    id="job-filters"
                    className={`store-filter-panel ${filtersOpen ? 'is-open' : ''}`}
                    aria-label="Job filters"
                >
                    <div className="store-filter-form">
                        <div className="store-filter-title">
                            <h2>
                                <SlidersHorizontal size={15} />
                                Filter jobs
                            </h2>
                            <button onClick={reset}>Reset filters</button>
                        </div>
                        <details open>
                            <summary>Football role</summary>
                            {choices('category', CATEGORIES, category)}
                        </details>
                        <details open>
                            <summary>Payment & engagement</summary>
                            {choices('engagement', ENGAGEMENTS, engagement)}
                        </details>
                        <details open={posted !== 'ALL'}>
                            <summary>Posting date</summary>
                            {choices('posted', POSTED_OPTIONS, posted)}
                        </details>
                        <details open={!!params.get('ageGroup') || !!params.get('level')}>
                            <summary>Team & experience</summary>
                            <div className="store-filter-fields">
                                {[
                                    ['ageGroup', 'Team age group', ageOptions],
                                    ['level', 'Experience', levels],
                                ].map(([key, label, options]) => (
                                    <label className="store-field" key={key as string}>
                                        {label as string}
                                        <select
                                            value={params.get(key as string) ?? ''}
                                            onChange={(e) => change(key as string, e.target.value)}
                                        >
                                            <option value="">Any</option>
                                            {(options as string[]).map((v) => (
                                                <option key={v}>{v}</option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </details>
                        <details open={!!country || !!city || !!params.get('clubId')}>
                            <summary>Club location</summary>
                            <div className="store-filter-fields">
                                <label className="store-field">
                                    Country
                                    <select
                                        value={country}
                                        onChange={(e) => change('country', e.target.value)}
                                    >
                                        <option value="">All countries</option>
                                        {country && !countries.includes(country) && (
                                            <option>{country}</option>
                                        )}
                                        {countries.map((v) => (
                                            <option key={v}>{v}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="store-field">
                                    City
                                    <select
                                        disabled={!country}
                                        value={city}
                                        onChange={(e) => change('city', e.target.value)}
                                    >
                                        <option value="">
                                            {country ? 'All cities' : 'Choose a country first'}
                                        </option>
                                        {city && !cities.includes(city) && <option>{city}</option>}
                                        {cities.map((v) => (
                                            <option key={v}>{v}</option>
                                        ))}
                                    </select>
                                </label>
                                {!fixedClubId && (
                                    <label className="store-field">
                                        Club
                                        <select
                                            value={params.get('clubId') ?? ''}
                                            onChange={(e) => change('clubId', e.target.value)}
                                        >
                                            <option value="">All clubs</option>
                                            {clubs.map((job) => (
                                                <option key={job.clubId} value={job.clubId ?? ''}>
                                                    {job.clubName}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>
                        </details>
                    </div>
                    <button
                        className="store-filter-done"
                        onClick={() => {
                            setFiltersOpen(false);
                            trigger.current?.focus();
                        }}
                    >
                        Show opportunities
                    </button>
                </aside>
                <section className="store-results" aria-label="Opportunities" aria-busy={loading}>
                    {loading ? (
                        <p role="status">Loading opportunities...</p>
                    ) : error ? (
                        <div role="alert" className="store-empty">
                            {error}
                            <button onClick={() => setReload((n) => n + 1)}>Try again</button>
                        </div>
                    ) : (
                        <>
                            <p className="store-result-count" role="status">
                                {filtered.length} {filtered.length === 1 ? 'opportunity' : 'opportunities'}
                            </p>
                            <div className="jobs-results-layout">
                                <div>
                                    {!visible.length ? (
                                        <div className="store-empty">
                                            <BriefcaseBusiness size={30} />
                                            <h2>No roles match these filters</h2>
                                            <button onClick={reset}>Clear search and filters</button>
                                        </div>
                                    ) : (
                                        <div className="jobs-list">
                                            {visible.map((job) => (
                                                <article
                                                    key={job.id}
                                                    className={`job-row ${selected?.id === job.id ? 'is-selected' : ''}`}
                                                >
                                                    <Link className="job-row-main" to={`/jobs/${job.id}`}>
                                                        {job.clubLogoUrl ? (
                                                            <img
                                                                className="job-logo"
                                                                src={resolveMediaUrl(job.clubLogoUrl)}
                                                                alt=""
                                                            />
                                                        ) : (
                                                            <Building2 className="job-logo" />
                                                        )}
                                                        <span className="job-body">
                                                            <h2>{job.title}</h2>
                                                            <span className="job-club">{job.clubName}</span>
                                                            <span className="job-meta">
                                                                <span>{locationLabel(job)}</span>
                                                                <span>
                                                                    {labelForEngagement(job.engagementType)}
                                                                </span>
                                                                <span>{relativeDate(job.createdAt)}</span>
                                                            </span>
                                                        </span>
                                                    </Link>
                                                    <div className="job-row-actions">
                                                        <Link to={`/jobs/${job.id}`}>
                                                            View opportunity <ArrowRight size={13} />
                                                        </Link>
                                                        <button
                                                            className="job-preview-trigger"
                                                            aria-label={`Preview ${job.title}`}
                                                            aria-pressed={selected?.id === job.id}
                                                            onClick={() => change('job', String(job.id))}
                                                        >
                                                            Preview
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                    {filtered.length > 12 && (
                                        <nav className="store-pagination" aria-label="Opportunity pages">
                                            <button
                                                disabled={page === 0}
                                                onClick={() => change('page', String(page - 1))}
                                            >
                                                Previous
                                            </button>
                                            <span>
                                                Page {page + 1} of {Math.ceil(filtered.length / 12)}
                                            </span>
                                            <button
                                                disabled={(page + 1) * 12 >= filtered.length}
                                                onClick={() => change('page', String(page + 1))}
                                            >
                                                Next
                                            </button>
                                        </nav>
                                    )}
                                </div>
                                {selected && (
                                    <aside className="job-preview" aria-label="Selected opportunity">
                                        <p className="store-eyebrow">Selected opportunity</p>
                                        <h2>{selected.title}</h2>
                                        <p>{selected.clubName}</p>
                                        <p>{locationLabel(selected)}</p>
                                        <p>{labelForEngagement(selected.engagementType)}</p>
                                        <p className="job-description">
                                            {selected.description ||
                                                'The club has not added a description yet.'}
                                        </p>
                                        <Link className="job-action" to={`/jobs/${selected.id}`}>
                                            View opportunity <ArrowRight size={15} />
                                        </Link>
                                    </aside>
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </Surface>
    );
};
