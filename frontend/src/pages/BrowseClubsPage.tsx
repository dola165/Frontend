import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Loader2, MapPin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/axiosConfig';
import { createClubApplication, fetchMyClubMembershipContext, selfRegisterClubPlayer } from '../features/clubs/api';
import { PaginationBar } from '../components/ui/PaginationBar';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';
import { ClubDirectoryFilters } from '../components/discovery/ClubDirectoryFilters';
import { ClubDirectoryToolbar, type ClubDirectoryFilterChip, type ClubDirectoryView } from '../components/discovery/ClubDirectoryToolbar';
import { ClubDirectoryCard } from '../components/discovery/ClubDirectoryCard';
import { ClubDirectoryResult } from '../components/discovery/ClubDirectoryResult';
import { DirectoryFilterDrawer } from '../components/discovery/DirectoryFilterDrawer';
import type { ClubDirectoryPageResult, ClubProfile } from '../components/discovery/clubDirectoryTypes';

const CLUB_DIRECTORY_VIEW_STORAGE_KEY = 'club-directory-view';

const readClubDirectoryView = (): ClubDirectoryView => {
    if (typeof window === 'undefined') return 'grid';
    try {
        return window.localStorage.getItem(CLUB_DIRECTORY_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
    } catch {
        return 'grid';
    }
};

export const BrowseClubsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { status, user } = useAuth();
    const { t } = useTranslation();
    const [urlSearchParams, setSearchParams] = useSearchParams();
    // Inputs need an immediate draft because router navigation runs in a transition.
    // A committed navigation (including back/forward) replaces that draft.
    const [filterDraft, setFilterDraft] = useState({ key: location.key, params: urlSearchParams });
    const searchParams = filterDraft.key === location.key ? filterDraft.params : urlSearchParams;
    if (filterDraft.key !== location.key) {
        setFilterDraft({ key: location.key, params: urlSearchParams });
    }

    // Only user actions write filters. Responses never navigate or restore filters.
    const search = searchParams.get('search') || '';
    const selectedTypes = searchParams.getAll('type');
    const selectedPolicies = searchParams.getAll('joinPolicy');
    const city = searchParams.get('city') || '';
    const country = searchParams.get('country') || '';
    const sort = searchParams.get('sort') || 'NEWEST';
    const requestedPage = Number(searchParams.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 0;
    const [pageSize, setPageSize] = useState(12);
    const [view, setView] = useState<ClubDirectoryView>(readClubDirectoryView);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const mobileFilterTriggerRef = useRef<HTMLButtonElement | null>(null);
    const mobileFilterCloseRef = useRef<HTMLButtonElement | null>(null);
    const hadMobileFiltersOpen = useRef(false);

    // Data state
    const [pageResult, setPageResult] = useState<ClubDirectoryPageResult<ClubProfile> | null>(null);
    const [clubs, setClubs] = useState<ClubProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [applyingClubId, setApplyingClubId] = useState<number | null>(null);
    const [joiningClubId, setJoiningClubId] = useState<number | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageType, setActionMessageType] = useState<'success' | 'error'>('success');

    const queryParams = new URLSearchParams();
    selectedTypes.forEach(type => queryParams.append('type', type));
    selectedPolicies.forEach(policy => queryParams.append('joinPolicy', policy));
    if (search) queryParams.set('search', search);
    if (city) queryParams.set('city', city);
    if (country) queryParams.set('country', country);
    if (sort !== 'NEWEST') queryParams.set('sort', sort);
    queryParams.set('page', String(page));
    queryParams.set('size', String(pageSize));
    const query = queryParams.toString();

    useEffect(() => {
        const controller = new AbortController();
        const loadClubs = async () => {
            setLoading(true);
            setErrorMessage(null);
            try {
                const response = await apiClient.get<ClubDirectoryPageResult<ClubProfile>>('/clubs?' + query, { signal: controller.signal });
                // Also guard adapters that finish even after cancellation.
                if (controller.signal.aborted) return;
                const result = response.data;
                const isPageResult = result && typeof result === 'object' && Array.isArray(result.content);
                setPageResult(isPageResult ? result : null);
                setClubs(isPageResult ? result.content : Array.isArray(result) ? result : []);
            } catch (error) {
                if (controller.signal.aborted) return;
                setClubs([]);
                setPageResult(null);
                setErrorMessage(extractApiErrorMessage(error, 'Failed to load the club directory.'));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void loadClubs();
        return () => controller.abort();
    }, [query, status, user?.id]);

    // Membership is independent of directory filters and must not delay results.
    useEffect(() => {
        let active = true;
        setMembershipContext(null);
        if (status === 'authenticated') {
            void fetchMyClubMembershipContext().then(context => {
                if (active) setMembershipContext(context);
            }).catch(() => { /* Keep the workspace unavailable if membership cannot load. */ });
        }
        return () => { active = false; };
    }, [status, user?.id]);

    const updateFilters = (update: (params: URLSearchParams) => void, resetPage = true) => {
        const next = new URLSearchParams(searchParams);
        if (resetPage) next.delete('page');
        update(next);
        if (next.toString() !== searchParams.toString()) {
            setFilterDraft({ key: location.key, params: next });
            setSearchParams(next, { replace: true, preventScrollReset: true });
        }
    };
    const setFilter = (key: string, value: string) => updateFilters(params => {
        if (value) params.set(key, value);
        else params.delete(key);
    });
    const setPage = (value: number) => updateFilters(params => {
        if (value > 0) params.set('page', String(value));
        else params.delete('page');
    }, false);

    useEffect(() => {
        try {
            window.localStorage.setItem(CLUB_DIRECTORY_VIEW_STORAGE_KEY, view);
        } catch {
            // Storage may be unavailable in private browsing; the in-memory preference still works.
        }
    }, [view]);

    useEffect(() => {
        if (!mobileFiltersOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileFiltersOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [mobileFiltersOpen]);

    useEffect(() => {
        if (mobileFiltersOpen) {
            mobileFilterCloseRef.current?.focus();
        } else if (hadMobileFiltersOpen.current) {
            mobileFilterTriggerRef.current?.focus();
        }
        hadMobileFiltersOpen.current = mobileFiltersOpen;
    }, [mobileFiltersOpen]);

    const showActionMessage = (text: string, type: 'success' | 'error') => {
        setActionMessage(text);
        setActionMessageType(type);
        setTimeout(() => setActionMessage(null), 4000);
    };

    const handleJoinClub = async (clubId: number) => {
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }
        setJoiningClubId(clubId);
        try {
            await selfRegisterClubPlayer(clubId);
            showActionMessage('Joined club as trialist.', 'success');
            setClubs((current) =>
                current.map((c) => (c.id === clubId ? { ...c, relationshipState: 'TRIALIST' as const } : c))
            );
        } catch (err) {
            showActionMessage(extractApiErrorMessage(err, 'Failed to join club.'), 'error');
        } finally {
            setJoiningClubId(null);
        }
    };

    const handleApplyClub = async (clubId: number) => {
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }
        setApplyingClubId(clubId);
        try {
            await createClubApplication(clubId, 'PLAYER', null);
            showActionMessage('Application submitted.', 'success');
            setClubs((current) =>
                current.map((c) => (c.id === clubId ? { ...c, relationshipState: 'APPLIED' as const } : c))
            );
        } catch (err) {
            showActionMessage(extractApiErrorMessage(err, 'Failed to submit application.'), 'error');
        } finally {
            setApplyingClubId(null);
        }
    };

    const handleFollowToggle = async (event: React.MouseEvent, clubId: number) => {
        event.preventDefault();
        setErrorMessage(null);
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }
        setClubs((current) =>
            current.map((club) =>
                club.id === clubId
                    ? { ...club, isFollowedByMe: !club.isFollowedByMe, followerCount: club.isFollowedByMe ? club.followerCount - 1 : club.followerCount + 1 }
                    : club
            )
        );
        try {
            await apiClient.post(`/clubs/${clubId}/follow`);
        } catch (error) {
            setClubs((current) =>
                current.map((club) =>
                    club.id === clubId
                        ? { ...club, isFollowedByMe: !club.isFollowedByMe, followerCount: club.isFollowedByMe ? club.followerCount - 1 : club.followerCount + 1 }
                        : club
                )
            );
            setErrorMessage(extractApiErrorMessage(error, 'Failed to update follow status.'));
        }
    };

    const toggleFilter = (key: string, value: string) => updateFilters(params => {
        const values = params.getAll(key);
        params.delete(key);
        (values.includes(value) ? values.filter(item => item !== value) : [...values, value])
            .forEach(item => params.append(key, item));
    });
    const toggleType = (type: string) => toggleFilter('type', type);
    const togglePolicy = (policy: string) => toggleFilter('joinPolicy', policy);
    const handleSearchChange = (value: string) => setFilter('search', value);
    const handleCityChange = (value: string) => setFilter('city', value);
    const handleCountryChange = (value: string) => setFilter('country', value);
    const handleSortChange = (value: string) => setFilter('sort', value === 'NEWEST' ? '' : value);
    const clearFilters = () => updateFilters(params => {
        ['search', 'type', 'joinPolicy', 'city', 'country', 'sort'].forEach(key => params.delete(key));
    });

    const hasActiveFilters = Boolean(search || selectedTypes.length > 0 || selectedPolicies.length > 0 || city || country || sort !== 'NEWEST');
    const activeFilterChips: ClubDirectoryFilterChip[] = [
        ...(search ? [{ id: 'search', label: `“${search}”` }] : []),
        ...selectedTypes.map((type) => ({ id: `type:${type}`, label: type.replace('_', ' ') })),
        ...selectedPolicies.map((policy) => ({ id: `joinPolicy:${policy}`, label: policy.replace(/_/g, ' ') })),
        ...(city ? [{ id: 'city', label: city }] : []),
        ...(country ? [{ id: 'country', label: country }] : [])
    ];

    const removeFilter = (id: string) => {
        const [kind, ...parts] = id.split(':');
        const value = parts.join(':');
        if (kind === 'type' || kind === 'joinPolicy') {
            updateFilters(params => {
                const values = params.getAll(kind).filter(item => item !== value);
                params.delete(kind);
                values.forEach(item => params.append(kind, item));
            });
        } else setFilter(kind, '');
    };

    const totalPages = pageResult?.totalPages ?? 0;

    return (
        <div className="club-design-scope club-directory-frame mx-auto w-full max-w-[var(--app-page-max-width)] min-h-full bg-transparent px-[var(--app-page-gutter)] py-6 text-[color:var(--text-primary)]">
            <div className="flex w-full flex-col gap-6">
                {/* Header */}
                <header className="club-directory-heading border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] pb-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--color-accent)]">Find your club</p>
                            <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text)]">Club Directory</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-secondary)]">
                                Explore clubs and academies. Search by name, location, club type or joining options.
                                {pageResult && ` ${pageResult.totalElements} clubs found.`}
                            </p>
                        </div>

                        <section className="club-directory-context rounded-xl bg-[var(--color-surface)] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-4 xl:w-[360px]">
                            <p className="text-[11px] font-medium text-[var(--color-secondary)]">My Club Workspace</p>
                            <div className="mt-3 flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)]">
                                    <Building2 className="h-4 w-4 text-[var(--color-accent)]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text)]">
                                        {status === 'authenticated' ? membershipContext?.clubName || 'No club attached' : 'Sign in required'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--color-secondary)]">
                                        {status === 'authenticated'
                                            ? membershipContext?.clubId
                                                ? 'Open your club workspace directly or create a new one if the role allows it.'
                                                : 'Create a club or review invites from existing clubs.'
                                            : 'Sign in to manage club operations or follow directory records.'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {status !== 'authenticated' ? (
                                    <button type="button" onClick={() => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash))}
                                        className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)]">Sign In</button>
                                ) : membershipContext?.canCreateClub ? (
                                    <button type="button" onClick={() => navigate('/clubs/create')}
                                        className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)]">
                                        <Plus className="h-3.5 w-3.5" />Create Club</button>
                                ) : null}
                                {status === 'authenticated' && membershipContext?.clubId && (
                                    <Link to={`/clubs/${membershipContext.clubId}`}
                                        className="inline-flex items-center gap-2 border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-medium text-[var(--color-text)]">
                                        Open My Club <ArrowRight className="h-3.5 w-3.5" /></Link>
                                )}
                            </div>
                        </section>
                    </div>
                </header>

                {/* Error / Action Messages */}
                {errorMessage && (
                    <div className="border border-[var(--fc-state-danger)] bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)] px-4 py-3 text-sm font-semibold">{errorMessage}</div>
                )}
                {actionMessage && (
                    <div className={`border px-4 py-3 text-sm font-semibold ${actionMessageType === 'success' ? 'border border-[var(--fc-state-success)] bg-[var(--fc-state-success-soft)] text-[var(--fc-state-success)]' : 'border border-[var(--fc-state-danger)] bg-[var(--fc-state-danger-soft)] text-[var(--fc-state-danger)]'}`}>
                        {actionMessage}
                    </div>
                )}

                <ClubDirectoryToolbar
                    search={search}
                    sort={sort}
                    resultCount={pageResult?.totalElements ?? clubs.length}
                    view={view}
                    hasActiveFilters={hasActiveFilters}
                    filtersOpen={mobileFiltersOpen}
                    activeFilterChips={activeFilterChips}
                    filterButtonRef={mobileFilterTriggerRef}
                    onSearchChange={handleSearchChange}
                    onSortChange={handleSortChange}
                    onClearFilters={clearFilters}
                    onRemoveFilter={removeFilter}
                    onOpenFilters={() => setMobileFiltersOpen(true)}
                    onViewChange={setView}
                />

                <div className="club-directory-layout grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
                    <aside className="hidden xl:sticky xl:top-[calc(var(--app-active-header-height)+4rem)] xl:block" aria-label={t('browseClubs.filters')}>
                        <ClubDirectoryFilters
                            selectedTypes={selectedTypes}
                            selectedPolicies={selectedPolicies}
                            city={city}
                            country={country}
                            hasActiveFilters={hasActiveFilters}
                            variant="rail"
                            onCityChange={handleCityChange}
                            onCountryChange={handleCountryChange}
                            onToggleType={toggleType}
                            onTogglePolicy={togglePolicy}
                            onClearFilters={clearFilters}
                        />
                    </aside>

                    <section aria-label={t('browseClubs.results')} aria-busy={loading} className={`club-directory-results relative min-w-0 ${view === 'grid' && clubs.length > 0 ? '' : 'rounded-xl border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)]'}`}>
                        {view === 'list' && (
                            <div className="club-directory-list-heading hidden border-b border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-4 py-3 text-[11px] font-medium text-[var(--color-secondary)] lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:gap-4">
                                <span>Club</span>
                                <span>Description</span>
                                <span>Location</span>
                                <span>Structure</span>
                                <span>Actions</span>
                            </div>
                        )}

                        {loading && <div role="status" className="absolute inset-x-0 top-2 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-[color:var(--theme-surface)] px-3 py-2 text-sm shadow">
                            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />Loading clubs…
                        </div>}
                        <div inert={loading} className={loading ? 'min-h-40 opacity-50' : ''}>
                            {clubs.length === 0 ? (
                                <div className={`px-4 py-12 text-center ${loading ? 'invisible' : ''}`}>
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] bg-[var(--color-surface)]">
                                        <Building2 className="h-6 w-6 text-[var(--color-accent)]" />
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-[var(--color-secondary)]">
                                        {hasActiveFilters ? t('browseClubs.emptyFiltered') : t('browseClubs.empty')}
                                    </p>
                                    <Link to="/map" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-opacity hover:opacity-90">
                                        <MapPin className="h-4 w-4" />
                                        {t('browseClubs.exploreMap')}
                                    </Link>
                                </div>
                            ) : view === 'grid' ? (
                                <div className="club-directory-card-grid grid w-full gap-4">
                                    {clubs.map((club) => (
                                        <ClubDirectoryCard
                                            key={club.id}
                                            club={club}
                                            authStatus={status}
                                            joiningClubId={joiningClubId}
                                            applyingClubId={applyingClubId}
                                            onJoin={handleJoinClub}
                                            onApply={handleApplyClub}
                                            onFollowToggle={handleFollowToggle}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--color-border)]">
                                    {clubs.map((club) => (
                                        <ClubDirectoryResult
                                            key={club.id}
                                            club={club}
                                            authStatus={status}
                                            joiningClubId={joiningClubId}
                                            applyingClubId={applyingClubId}
                                            onJoin={handleJoinClub}
                                            onApply={handleApplyClub}
                                            onFollowToggle={handleFollowToggle}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <DirectoryFilterDrawer
                    open={mobileFiltersOpen}
                    title={t('browseClubs.filters')}
                    closeLabel={t('browseClubs.closeFilters')}
                    closeRef={mobileFilterCloseRef}
                    onClose={() => setMobileFiltersOpen(false)}
                >
                    <ClubDirectoryFilters
                        selectedTypes={selectedTypes}
                        selectedPolicies={selectedPolicies}
                        city={city}
                        country={country}
                        hasActiveFilters={hasActiveFilters}
                        variant="drawer"
                        onCityChange={handleCityChange}
                        onCountryChange={handleCountryChange}
                        onToggleType={toggleType}
                        onTogglePolicy={togglePolicy}
                        onClearFilters={clearFilters}
                    />
                </DirectoryFilterDrawer>

                <div className="club-directory-pagination"><PaginationBar
                    page={page}
                    totalPages={totalPages}
                    totalElements={pageResult?.totalElements ?? 0}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
                /></div>
            </div>
        </div>
    );
};
