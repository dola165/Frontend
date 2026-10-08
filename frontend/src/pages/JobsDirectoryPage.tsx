import { useClubProfileSearchParams } from '../features/clubs/clubProfilePreviewContext';
import { useFilterDisclosure } from '../hooks/useFilterDisclosure';
import { MediaImage } from '../components/ui/MediaImage';
import { OpportunityNavigation } from '../components/discovery/OpportunityNavigation';
import { opportunityReturnState } from '../components/discovery/opportunityReturnContext';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    ArrowRight,
    BadgeDollarSign,
    BriefcaseBusiness,
    Building2,
    CalendarClock,
    HeartHandshake,
    MapPin,
    Search,
    SlidersHorizontal,
    UsersRound,
    X,
} from 'lucide-react';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { fetchOpenJobDirectory, type ClubJob } from '../features/clubs/api';
import {
    CATEGORIES,
    ENGAGEMENTS,
    POSTED_OPTIONS,
} from '../features/clubs/jobLabels';
import { useJobsOpportunitiesCopy } from '../features/clubs/jobsOpportunitiesCopy';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { resolveExtensionCapability } from '../features/capabilities/extensions';
import '../features/store/store.css';
import '../features/clubs/jobs-opportunities.css';

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

export const JobsDirectoryPage = ({ fixedClubId, clubName, previewMockMode }: {
    fixedClubId?: number;
    clubName?: string;
    previewMockMode?: boolean;
}) => {
    const location = useLocation();
    const volunteerShifts = resolveExtensionCapability(
        'volunteerShifts',
        import.meta.env.DEV && previewMockMode !== undefined ? { mockMode: previewMockMode } : undefined,
    );
    const {
        copy,
        category: categoryLabel,
        engagement: engagementLabel,
        applicationMethod,
        expectedNextStep,
        eligibility,
        location: jobLocation,
        relativeDate: jobRelativeDate,
        postedOption,
    } = useJobsOpportunitiesCopy();
    const [params, setParams] = useClubProfileSearchParams();
    const [jobs, setJobs] = useState<ClubJob[]>([]);
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(''),
        [reload, setReload] = useState(0);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [asOf, setAsOf] = useState(() => Date.now());
    const trigger = useRef<HTMLButtonElement>(null);
    useFilterDisclosure(filtersOpen, () => setFiltersOpen(false), trigger);
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
                    setError('load');
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
                `${job.title} ${job.description ?? ''} ${job.clubName ?? ''} ${categoryLabel(job.category)}`
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
    const selected = visible.find((job) => job.id === Number(params.get('job')));
    const chips = Object.entries(filterNames).filter(
        ([key]) => !!params.get(key) && params.get(key) !== 'ALL',
    );
    const chipValue = (key: string) => {
        const value = params.get(key);
        if (key === 'category') return categoryLabel(value);
        if (key === 'engagement') return engagementLabel(value);
        if (key === 'posted') return postedOption(value ?? 'ALL');
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
                {key === 'category'
                    ? categoryLabel(option.value)
                    : key === 'engagement'
                        ? engagementLabel(option.value)
                        : postedOption(option.value)}
            </button>
        ));
    const Surface = fixedClubId ? 'section' : 'main';
    const filterLabels: Record<string, string> = {
        search: copy('searchLabel'),
        category: copy('footballRole'),
        engagement: copy('engagement'),
        posted: copy('postingDate'),
        ageGroup: copy('ageGroup'),
        level: copy('experience'),
        country: copy('country'),
        city: copy('city'),
        clubId: copy('club'),
    };
    return (
        <Surface className={`store-page jobs-page ${fixedClubId ? 'jobs-embedded' : ''}`}>
            {!fixedClubId && <DiscoverySectionTabs />}
            <header className="store-heading jobs-heading">
                <div>
                    <p className="store-eyebrow">{copy('eyebrow')}</p>
                    <h1>
                        {fixedClubId
                            ? copy('clubTitle', { club: clubName ?? copy('club') })
                            : copy('title')}
                    </h1>
                    <p className="store-subtitle">
                        {copy(fixedClubId ? 'clubSubtitle' : 'subtitle')}
                    </p>
                </div>
                <button
                    className="store-cart-link jobs-refresh"
                    onClick={() => setReload((n) => n + 1)}
                    disabled={loading}
                >
                    {copy('refresh')}
                </button>
            </header>
            {fixedClubId && <OpportunityNavigation section="jobs" clubId={fixedClubId}/>}
            {!fixedClubId && <nav className="jobs-browse-shortcuts" aria-label={copy('browseByIntent')}>
                <button type="button" className="jobs-text-link" onClick={() => change('category', 'COACHING')}><UsersRound size={17}/>{copy('coachingAction')}<ArrowRight size={14}/></button>
                <button type="button" className="jobs-text-link" onClick={() => change('engagement', 'VOLUNTEER')}><HeartHandshake size={17}/>{copy('volunteerAction')}<ArrowRight size={14}/></button>
                <button type="button" className="jobs-text-link" onClick={reset}><BriefcaseBusiness size={17}/>{copy('otherRolesAction')}<ArrowRight size={14}/></button>
            </nav>}
            <aside className={`jobs-engagement-guide ${fixedClubId ? 'is-embedded' : ''}`} aria-label="Volunteer shifts availability">
                <div className="jobs-engagement-heading">
                    <span>{copy('engagementGuide')}</span>
                </div>
                <div className="jobs-engagement-items">
                    <div><BadgeDollarSign aria-hidden="true" /><p><strong>{copy('paid')}</strong>{copy('paidBody')}</p></div>
                    <div><HeartHandshake aria-hidden="true" /><p><strong>{copy('volunteer')}</strong>{copy('volunteerBody')}</p></div>
                    <div><UsersRound aria-hidden="true" /><p><strong>{copy('flexible')}</strong>{copy('flexibleBody')}</p></div>
                </div>
                <details className="jobs-event-shifts">
                    <summary>
                        <CalendarClock aria-hidden="true" />
                        <strong>{copy('eventShifts')}</strong>
                        <span className={volunteerShifts.available ? 'extension-demo-label' : 'jobs-coming-later'}>
                            {copy(volunteerShifts.available ? 'localDemo' : 'comingLater')}
                        </span>
                        {!volunteerShifts.available && <span className="jobs-event-shifts-status">{copy('eventShiftsUnavailable')}</span>}
                    </summary>
                    <div className="jobs-event-shifts-detail">
                        <p>{copy('eventShiftsBody')}</p>
                        {volunteerShifts.available && <Link className="jobs-text-link" to="/volunteering">{copy('openEventShifts')}<ArrowRight size={14} /></Link>}
                    </div>
                </details>
            </aside>
            <div className="jobs-listing-intro">
                <div><h2>{copy('listings')}</h2><p>{copy('listingsBody')}</p></div>
            </div>
            <div className="store-toolbar">
                <label className="store-search">
                    <Search size={18} />
                    <span className="sr-only">{copy('searchLabel')}</span>
                    <input
                        maxLength={100}
                        value={search}
                        onChange={(e) => change('search', e.target.value)}
                        placeholder={copy('searchPlaceholder')}
                    />
                </label>
                <label className="store-sort">
                    {copy('sort')}
                    <select
                        value={params.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST'}
                        onChange={(e) => change('sort', e.target.value)}
                    >
                        <option value="NEWEST">{copy('newest')}</option>
                        <option value="OLDEST">{copy('oldest')}</option>
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
                    {copy(filtersOpen ? 'hideFilters' : 'filters')}
                </button>
            </div>
            {!!chips.length && (
                <div className="store-filter-chips" aria-label={copy('selectedFilters')}>
                    {chips.map(([key, label]) => (
                        <button
                            key={key}
                            aria-label={`Remove ${label} filter`}
                            onClick={() => change(key, '')}
                        >
                            {filterLabels[key]}: {chipValue(key)}
                            <X size={13} />
                        </button>
                    ))}
                </div>
            )}
            <div className="store-catalog-layout">
                <aside
                    id="job-filters"
                    className={`store-filter-panel ${filtersOpen ? 'is-open' : ''}`}
                    aria-label={copy('filters')}
                >
                    <div className="store-filter-form">
                        <div className="store-filter-title">
                            <h2>
                                <SlidersHorizontal size={15} />
                                {copy('filterRoles')}
                            </h2>
                            <button onClick={reset}>{copy('resetFilters')}</button>
                        </div>
                        <details open>
                            <summary>{copy('footballRole')}</summary>
                            {choices('category', CATEGORIES, category)}
                        </details>
                        <details open>
                            <summary>{copy('engagement')}</summary>
                            {choices('engagement', ENGAGEMENTS, engagement)}
                        </details>
                        <details open={posted !== 'ALL'}>
                            <summary>{copy('postingDate')}</summary>
                            {choices('posted', POSTED_OPTIONS, posted)}
                        </details>
                        <details open={!!params.get('ageGroup') || !!params.get('level')}>
                            <summary>{copy('teamExperience')}</summary>
                            <div className="store-filter-fields">
                                {[
                                    ['ageGroup', copy('ageGroup'), ageOptions],
                                    ['level', copy('experience'), levels],
                                ].map(([key, label, options]) => (
                                    <label className="store-field" key={key as string}>
                                        {label as string}
                                        <select
                                            value={params.get(key as string) ?? ''}
                                            onChange={(e) => change(key as string, e.target.value)}
                                        >
                                            <option value="">{copy('any')}</option>
                                            {(options as string[]).map((v) => (
                                                <option key={v}>{v}</option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </details>
                        <details open={!!country || !!city || !!params.get('clubId')}>
                            <summary>{copy('clubLocation')}</summary>
                            <div className="store-filter-fields">
                                <label className="store-field">
                                    {copy('country')}
                                    <select
                                        value={country}
                                        onChange={(e) => change('country', e.target.value)}
                                    >
                                        <option value="">{copy('allCountries')}</option>
                                        {country && !countries.includes(country) && (
                                            <option>{country}</option>
                                        )}
                                        {countries.map((v) => (
                                            <option key={v}>{v}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="store-field">
                                    {copy('city')}
                                    <select
                                        disabled={!country}
                                        value={city}
                                        onChange={(e) => change('city', e.target.value)}
                                    >
                                        <option value="">
                                            {copy(country ? 'allCities' : 'chooseCountry')}
                                        </option>
                                        {city && !cities.includes(city) && <option>{city}</option>}
                                        {cities.map((v) => (
                                            <option key={v}>{v}</option>
                                        ))}
                                    </select>
                                </label>
                                {!fixedClubId && (
                                    <label className="store-field">
                                        {copy('club')}
                                        <select
                                            value={params.get('clubId') ?? ''}
                                            onChange={(e) => change('clubId', e.target.value)}
                                        >
                                            <option value="">{copy('allClubs')}</option>
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
                        {copy('showRoles')}
                    </button>
                </aside>
                <section className="store-results jobs-results" aria-label={copy('listings')} aria-busy={loading}>
                    {loading ? (
                        <div className="jobs-loading" role="status">
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                            <span aria-hidden="true" />
                            <p>{copy('loadingRoles')}</p>
                        </div>
                    ) : error ? (
                        <div role="alert" className="store-empty">
                            <h2>{copy('loadError')}</h2>
                            <button onClick={() => setReload((n) => n + 1)}>{copy('tryAgain')}</button>
                        </div>
                    ) : (
                        <>
                            <p className="store-result-count" role="status">
                                {copy('roleCount', { count: filtered.length, suffix: filtered.length === 1 ? '' : 's' })}
                            </p>
                            {!visible.length ? (
                                <div className="store-empty jobs-empty">
                                    <BriefcaseBusiness size={30} />
                                    <h2>{copy('noMatches')}</h2>
                                    <p>{copy('noMatchesBody')}</p>
                                    <button onClick={reset}>{copy('clearFilters')}</button>
                                </div>
                            ) : (
                                <div className="jobs-list">
                                    {visible.map((job) => {
                                        const open = selected?.id === job.id;
                                        const whoItSuits = eligibility(job);
                                        return <article key={job.id} className={`job-row ${open ? 'is-selected' : ''}`}>
                                            <div className="job-row-main">
                                                {job.clubLogoUrl ? (
                                                    <MediaImage className="job-logo" src={resolveMediaUrl(job.clubLogoUrl)} alt="" />
                                                ) : (
                                                    <span className="job-logo job-logo-placeholder"><Building2 aria-hidden="true" /></span>
                                                )}
                                                <div className="job-body">
                                                    <div className="job-badges">
                                                        <span>{categoryLabel(job.category)}</span>
                                                        <span>{copy('engagementFact')}: {engagementLabel(job.engagementType)}</span>
                                                    </div>
                                                    <Link className="job-title-link" aria-label={`${job.title} ${job.clubName ?? ''}`} to={`/jobs/${job.id}`} state={opportunityReturnState('jobs', location)}>
                                                        <h2>{job.title}</h2>
                                                    </Link>
                                                    <span className="job-club">{job.clubName}</span>
                                                    <span className="job-location"><MapPin size={14} aria-hidden="true" />{jobLocation(job)} · {jobRelativeDate(job.createdAt)}</span>
                                                    <span className="job-meta">
                                                        {whoItSuits && <span>{whoItSuits}</span>}
                                                        <span>{copy('applicationMethod')}: {applicationMethod(job)}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="job-row-actions">
                                                <Link to={`/jobs/${job.id}`} state={opportunityReturnState('jobs', location)}>
                                                    {copy('viewRole')} <ArrowRight size={13} />
                                                </Link>
                                                <button
                                                    className="job-preview-trigger"
                                                    aria-label={`${open ? copy('closePreview') : 'Preview'} ${job.title}`}
                                                    aria-expanded={open}
                                                    onClick={() => change('job', open ? '' : String(job.id))}
                                                >
                                                    {copy(open ? 'closePreview' : 'preview')}
                                                </button>
                                            </div>
                                            {open && <div className="job-inline-preview">
                                                <div>
                                                    <span>{copy('nextStep')}</span>
                                                    <strong>{expectedNextStep(job)}</strong>
                                                </div>
                                                <p>{job.description || copy('noDescription')}</p>
                                            </div>}
                                        </article>;
                                    })}
                                </div>
                            )}
                            {filtered.length > 12 && (
                                <nav className="store-pagination" aria-label={copy('listings')}>
                                    <button disabled={page === 0} onClick={() => change('page', String(page - 1))}>{copy('previous')}</button>
                                    <span>{copy('pageOf', { page: page + 1, pages: Math.ceil(filtered.length / 12) })}</span>
                                    <button disabled={(page + 1) * 12 >= filtered.length} onClick={() => change('page', String(page + 1))}>{copy('next')}</button>
                                </nav>
                            )}
                        </>
                    )}
                </section>
            </div>
        </Surface>
    );
};
