import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { HeartHandshake, Search, SlidersHorizontal, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import {
    fetchCampaigns,
    fetchCampaignLocations,
    CAMPAIGN_CATEGORIES,
    CURRENCIES,
    campaignCategory,
    campaignDate,
    campaignPhase,
    type Campaign,
} from '../features/campaigns/api';
import { CampaignProgress } from '../features/campaigns/CampaignProgress';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
const filterLabels: Record<string, string> = {
    query: 'Search',
    category: 'Category',
    currency: 'Currency',
    country: 'Country',
    city: 'City',
    state: 'Status',
};
export const CampaignsPage = () => {
    const { id } = useParams(),
        clubId = id ? Number(id) : undefined,
        [params, setParams] = useSearchParams();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]),
        [total, setTotal] = useState(0),
        [clubName, setClubName] = useState('');
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(''),
        [reload, setReload] = useState(0);
    const [locations, setLocations] = useState<{ country: string; city: string | null }[]>([]),
        [locationError, setLocationError] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false),
        trigger = useRef<HTMLButtonElement>(null);
    const query = params.toString(),
        page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
    const change = (key: string, value: string) =>
        setParams((current) => {
            const next = new URLSearchParams(current);
            if (value) next.set(key, value);
            else next.delete(key);
            if (key !== 'page') next.delete('page');
            if (key === 'country') next.delete('city');
            return next;
        });
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // Reset stale content when synchronizing with another request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError('');
        setCampaigns([]);
        setClubName('');
        const search = new URLSearchParams(query),
            category = search.get('category'),
            currency = search.get('currency');
        if (clubId !== undefined && (!Number.isSafeInteger(clubId) || clubId < 1)) {
            setError('This club could not be found.');
            setLoading(false);
            return;
        }
        const club = clubId
            ? apiClient
                  .get<{ name: string }>(`/clubs/${clubId}`, { signal: controller.signal })
                  .then((r) => r.data.name)
            : Promise.resolve('');
        void Promise.all([
            fetchCampaigns(
                {
                    clubId,
                    page,
                    size: 12,
                    query: search.get('query') || undefined,
                    category: CAMPAIGN_CATEGORIES.some((c) => c.value === category) ? category! : undefined,
                    currency: CURRENCIES.some((c) => c === currency) ? currency! : undefined,
                    country: search.get('country') || undefined,
                    city: search.get('city') || undefined,
                    state: search.get('state') === 'ALL' ? 'ALL' : 'ACTIVE',
                    sort: search.get('sort') === 'ENDING' ? 'ENDING' : 'NEWEST',
                },
                controller.signal,
            ),
            club,
        ])
            .then(([data, name]) => {
                if (active) {
                    setCampaigns(data.content);
                    setTotal(data.totalElements);
                    setClubName(name);
                }
            })
            .catch(() => {
                if (active) setError('Campaigns could not load. Please try again.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [clubId, page, query, reload]);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // Location options belong to the current club only.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocations([]);
        setLocationError('');
        void fetchCampaignLocations(clubId, controller.signal)
            .then((data) => {
                if (active) setLocations(data);
            })
            .catch(() => {
                if (active) setLocationError('Club locations could not load.');
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [clubId, reload]);
    const countries = [...new Set(locations.map((l) => l.country))].sort(),
        cities = [
            ...new Set(
                locations
                    .filter((l) => l.country === params.get('country'))
                    .map((l) => l.city)
                    .filter((v): v is string => !!v),
            ),
        ].sort();
    const selected = Object.entries(filterLabels).filter(([key]) => !!params.get(key));
    return (
        <main className="store-page campaigns-page">
            <DiscoverySectionTabs />
            <header className="store-heading">
                <div>
                    <p className="store-eyebrow">Build the future of your club</p>
                    <h1>{clubId ? `${clubName || 'Club'} campaigns` : 'Fundraising & campaigns'}</h1>
                    <p className="store-subtitle">
                        Support the pitches, people and projects that keep football growing.
                    </p>
                </div>
                <button
                    className="store-cart-link"
                    disabled={loading}
                    onClick={() => setReload((n) => n + 1)}
                >
                    Refresh
                </button>
            </header>
            {clubId && (
                <nav className="store-scope-links" aria-label="Campaign scope">
                    <Link to={`/clubs/${clubId}`}>Back to club</Link>
                    <Link to="/campaigns">Browse all campaigns</Link>
                </nav>
            )}
            <p className="store-notice">
                <span className="store-notice-dot" />
                Discover projects and contact the clubs behind them. Online contributions are not available
                yet.
            </p>
            <div className="store-toolbar">
                <label className="store-search">
                    <Search size={18} />
                    <span className="sr-only">Search campaigns</span>
                    <input
                        maxLength={100}
                        value={params.get('query') ?? ''}
                        onChange={(e) => change('query', e.target.value)}
                        placeholder="Search campaigns or clubs"
                    />
                </label>
                <label className="store-sort">
                    Sort
                    <select
                        value={params.get('sort') === 'ENDING' ? 'ENDING' : 'NEWEST'}
                        onChange={(e) => change('sort', e.target.value)}
                    >
                        <option value="NEWEST">Newest</option>
                        <option value="ENDING">Ending soon</option>
                    </select>
                </label>
                <button
                    ref={trigger}
                    className="store-filter-toggle"
                    aria-expanded={filtersOpen}
                    aria-controls="campaign-filters"
                    onClick={() => setFiltersOpen((v) => !v)}
                >
                    <SlidersHorizontal size={16} />
                    {filtersOpen ? 'Hide filters' : 'Filters'}
                </button>
            </div>
            {!!selected.length && (
                <div className="store-filter-chips" aria-label="Selected campaign filters">
                    {selected.map(([key, label]) => (
                        <button
                            key={key}
                            aria-label={`Remove ${label} filter`}
                            onClick={() => change(key, '')}
                        >
                            {label}:{' '}
                            {key === 'category'
                                ? campaignCategory(params.get(key)!)
                                : key === 'state'
                                  ? 'All published campaigns'
                                  : params.get(key)}
                            <X size={13} />
                        </button>
                    ))}
                </div>
            )}
            <div className="store-catalog-layout">
                <aside
                    id="campaign-filters"
                    aria-label="Campaign filters"
                    className={`store-filter-panel ${filtersOpen ? 'is-open' : ''}`}
                >
                    <form className="store-filter-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="store-filter-title">
                            <h2>
                                <SlidersHorizontal size={15} />
                                Filter campaigns
                            </h2>
                            <button type="button" onClick={() => setParams({})}>
                                Reset filters
                            </button>
                        </div>
                        <details open>
                            <summary>Campaign purpose</summary>
                            {[{ value: '', label: 'All campaigns' }, ...CAMPAIGN_CATEGORIES].map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    className="opportunity-choice"
                                    aria-pressed={(params.get('category') ?? '') === c.value}
                                    onClick={() => change('category', c.value)}
                                >
                                    <span aria-hidden="true" />
                                    {c.label}
                                </button>
                            ))}
                        </details>
                        <details open>
                            <summary>Availability & currency</summary>
                            <div className="store-filter-fields">
                                <label className="store-field">
                                    Campaign status
                                    <select
                                        value={params.get('state') === 'ALL' ? 'ALL' : 'ACTIVE'}
                                        onChange={(e) =>
                                            change('state', e.target.value === 'ACTIVE' ? '' : e.target.value)
                                        }
                                    >
                                        <option value="ACTIVE">Active now</option>
                                        <option value="ALL">All published campaigns</option>
                                    </select>
                                </label>
                                <label className="store-field">
                                    Currency
                                    <select
                                        value={params.get('currency') ?? ''}
                                        onChange={(e) => change('currency', e.target.value)}
                                    >
                                        <option value="">All currencies</option>
                                        {CURRENCIES.map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </details>
                        <details open={!!params.get('country')}>
                            <summary>Club location</summary>
                            <div className="store-filter-fields">
                                {locationError && (
                                    <p role="alert">
                                        {locationError}{' '}
                                        <button type="button" onClick={() => setReload((n) => n + 1)}>
                                            Retry locations
                                        </button>
                                    </p>
                                )}
                                <label className="store-field">
                                    Country
                                    <select
                                        value={params.get('country') ?? ''}
                                        onChange={(e) => change('country', e.target.value)}
                                    >
                                        <option value="">All countries</option>
                                        {params.get('country') &&
                                            !countries.includes(params.get('country')!) && (
                                                <option>{params.get('country')}</option>
                                            )}
                                        {countries.map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="store-field">
                                    City
                                    <select
                                        value={params.get('city') ?? ''}
                                        disabled={!params.get('country')}
                                        onChange={(e) => change('city', e.target.value)}
                                    >
                                        <option value="">
                                            {params.get('country') ? 'All cities' : 'Choose a country first'}
                                        </option>
                                        {params.get('city') && !cities.includes(params.get('city')!) && (
                                            <option>{params.get('city')}</option>
                                        )}
                                        {cities.map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </details>
                    </form>
                    <button
                        className="store-filter-done"
                        onClick={() => {
                            setFiltersOpen(false);
                            trigger.current?.focus();
                        }}
                    >
                        Show campaigns
                    </button>
                </aside>
                <section className="store-results" aria-label="Campaigns" aria-busy={loading}>
                    {loading ? (
                        <p role="status">Loading campaigns...</p>
                    ) : error ? (
                        <div className="store-empty" role="alert">
                            {error}
                            <button onClick={() => setReload((n) => n + 1)}>Retry</button>
                        </div>
                    ) : (
                        <>
                            <p role="status" className="store-result-count">
                                {total} {total === 1 ? 'campaign' : 'campaigns'} matching this search
                            </p>
                            {!campaigns.length ? (
                                <div className="store-empty">
                                    <HeartHandshake size={34} />
                                    <h2>No campaigns found</h2>
                                    <p>Try another search or include all published campaigns.</p>
                                    <button onClick={() => setParams({ state: 'ALL' })}>
                                        Show all published campaigns
                                    </button>
                                </div>
                            ) : (
                                <div className="campaign-grid">
                                    {campaigns.map((c) => (
                                        <article key={c.id} className="campaign-card">
                                            <Link
                                                aria-label={`Open ${c.title}`}
                                                to={`/campaigns/${c.id}`}
                                                className="campaign-cover"
                                            >
                                                {c.images[0] ? (
                                                    <img
                                                        src={resolveMediaUrl(c.images[0])}
                                                        alt=""
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <HeartHandshake size={50} />
                                                )}
                                                <span className="campaign-phase">
                                                    {campaignPhase(c.phase)}
                                                </span>
                                            </Link>
                                            <div className="campaign-card-body">
                                                <p className="store-eyebrow">
                                                    {campaignCategory(c.category)}
                                                </p>
                                                <h2>
                                                    <Link to={`/campaigns/${c.id}`}>{c.title}</Link>
                                                </h2>
                                                <Link
                                                    className="campaign-club"
                                                    to={`/clubs/${c.clubId}/campaigns`}
                                                >
                                                    {c.clubName}
                                                    {c.city ? ` · ${c.city}` : ''}
                                                </Link>
                                                <p className="campaign-summary">{c.summary}</p>
                                                <CampaignProgress campaign={c} compact />
                                                {c.endsOn && (
                                                    <p className="store-hint">
                                                        Through {campaignDate(c.endsOn)}
                                                    </p>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                            {(page > 0 || total > 12) && (
                                <nav className="store-pagination" aria-label="Campaign pages">
                                    <button
                                        disabled={page === 0}
                                        onClick={() => change('page', String(page - 1))}
                                    >
                                        Previous
                                    </button>
                                    <span>
                                        Page {page + 1} of {Math.max(1, Math.ceil(total / 12))}
                                    </span>
                                    <button
                                        disabled={(page + 1) * 12 >= total}
                                        onClick={() => change('page', String(page + 1))}
                                    >
                                        Next
                                    </button>
                                </nav>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    );
};
