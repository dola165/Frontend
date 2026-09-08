import { useCallback, useEffect, useRef, useState } from 'react';
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
    const { status } = useAuth();
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state (synced to URL)
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(searchParams.getAll('type'));
    const [selectedPolicies, setSelectedPolicies] = useState<string[]>(searchParams.getAll('joinPolicy'));
    const [city, setCity] = useState(searchParams.get('city') || '');
    const [country, setCountry] = useState(searchParams.get('country') || '');
    const [sort, setSort] = useState(searchParams.get('sort') || 'NEWEST');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
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

    const buildQueryParams = useCallback((overrides?: Record<string, string>) => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        selectedTypes.forEach((t) => params.append('type', t));
        selectedPolicies.forEach((p) => params.append('joinPolicy', p));
        if (city) params.set('city', city);
        if (country) params.set('country', country);
        if (sort !== 'NEWEST') params.set('sort', sort);
        if (page > 0) params.set('page', String(page));
        if (overrides) Object.entries(overrides).forEach(([k, v]) => { if (v) params.set(k, v); else params.delete(k); });
        return params;
    }, [search, selectedTypes, selectedPolicies, city, country, sort, page]);

    const loadClubs = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const queryParams = new URLSearchParams();
            selectedTypes.forEach((t) => queryParams.append('type', t));
            selectedPolicies.forEach((p) => queryParams.append('joinPolicy', p));
            if (search) queryParams.set('search', search);
            if (city) queryParams.set('city', city);
            if (country) queryParams.set('country', country);
            if (sort !== 'NEWEST') queryParams.set('sort', sort);
            queryParams.set('page', String(page));
            queryParams.set('size', String(pageSize));

            const membershipPromise =
                status === 'authenticated'
                    ? fetchMyClubMembershipContext().catch(() => null)
                    : Promise.resolve(null);

            const [clubsResponse, membershipResponse] = await Promise.all([
                apiClient.get<ClubDirectoryPageResult<ClubProfile>>(`/clubs?${queryParams.toString()}`),
                membershipPromise
            ]);

            const result = clubsResponse.data;
            // Handle both PageResult and legacy List response formats
            const isPageResult = result && typeof result === 'object' && Array.isArray(result.content);
            setPageResult(isPageResult ? result : null);
            setClubs(isPageResult ? result.content : Array.isArray(result) ? result : []);
            setMembershipContext(membershipResponse);

            // Sync URL
            setSearchParams(buildQueryParams(), { replace: true });
        } catch (error) {
            setClubs([]);
            setPageResult(null);
            setMembershipContext(null);
            setErrorMessage(extractApiErrorMessage(error, 'Failed to load the club directory.'));
        } finally {
            setLoading(false);
        }
    }, [status, search, selectedTypes, selectedPolicies, city, country, sort, page, pageSize, buildQueryParams, setSearchParams]);

    // Sync URL → local state on browser back/forward navigation
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        const urlTypes = searchParams.getAll('type');
        const urlPolicies = searchParams.getAll('joinPolicy');
        const urlCity = searchParams.get('city') || '';
        const urlCountry = searchParams.get('country') || '';
        const urlSort = searchParams.get('sort') || 'NEWEST';
        const urlPage = Number(searchParams.get('page')) || 0;

        // Only update if URL differs from current state (prevents loops)
        if (urlSearch !== search) setSearch(urlSearch);
        if (urlTypes.length !== selectedTypes.length || !urlTypes.every(t => selectedTypes.includes(t))) setSelectedTypes(urlTypes);
        if (urlPolicies.length !== selectedPolicies.length || !urlPolicies.every(p => selectedPolicies.includes(p))) setSelectedPolicies(urlPolicies);
        if (urlCity !== city) setCity(urlCity);
        if (urlCountry !== country) setCountry(urlCountry);
        if (urlSort !== sort) setSort(urlSort);
        if (urlPage !== page) setPage(urlPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        void loadClubs();
    }, [loadClubs]);

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

    const toggleType = (type: string) => {
        setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
        setPage(0);
    };

    const togglePolicy = (policy: string) => {
        setSelectedPolicies((prev) => prev.includes(policy) ? prev.filter((p) => p !== policy) : [...prev, policy]);
        setPage(0);
    };

    const handleSearchChange = (value: string) => { setSearch(value); setPage(0); };
    const handleCityChange = (value: string) => { setCity(value); setPage(0); };
    const handleCountryChange = (value: string) => { setCountry(value); setPage(0); };
    const handleSortChange = (value: string) => { setSort(value); setPage(0); };

    const clearFilters = () => {
        setSearch('');
        setSelectedTypes([]);
        setSelectedPolicies([]);
        setCity('');
        setCountry('');
        setSort('NEWEST');
        setPage(0);
    };

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
        if (kind === 'search') setSearch('');
        if (kind === 'type') setSelectedTypes((current) => current.filter((item) => item !== value));
        if (kind === 'joinPolicy') setSelectedPolicies((current) => current.filter((item) => item !== value));
        if (kind === 'city') setCity('');
        if (kind === 'country') setCountry('');
        setPage(0);
    };

    const totalPages = pageResult?.totalPages ?? 0;

    if (loading && clubs.length === 0) {
        return (
            <div className="flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center bg-transparent">
                <Loader2 className="h-9 w-9 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    return (
        <div className="min-h-full bg-transparent px-[var(--app-page-gutter)] py-6 text-[color:var(--text-primary)]">
            <div className="flex w-full flex-col gap-6">
                {/* Header */}
                <header className="border-b border-[#ffffff0d] pb-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold text-[#16a34a]">Destination Page</p>
                            <h1 className="mt-2 text-3xl font-semibold text-[#f4f4f5]">Club Directory</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a1a1aa]">
                                Browse clubs as operational records: filter by type, location, join policy, or search by name.
                                {pageResult && ` ${pageResult.totalElements} clubs found.`}
                            </p>
                        </div>

                        <section className="rounded-xl bg-[#16181d] border border-[#ffffff0d] px-4 py-4 xl:w-[360px]">
                            <p className="text-[11px] font-medium text-[#a1a1aa]">My Club Workspace</p>
                            <div className="mt-3 flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-[#ffffff0d] bg-[#0f1117]">
                                    <Building2 className="h-4 w-4 text-[#16a34a]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#f4f4f5]">
                                        {status === 'authenticated' ? membershipContext?.clubName || 'No club attached' : 'Sign in required'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[#a1a1aa]">
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
                                        className="rounded-xl px-3 py-1.5 text-xs font-medium bg-[#16a34a] text-white">Sign In</button>
                                ) : membershipContext?.canCreateClub ? (
                                    <button type="button" onClick={() => navigate('/clubs/create')}
                                        className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium bg-[#16a34a] text-white">
                                        <Plus className="h-3.5 w-3.5" />Create Club</button>
                                ) : null}
                                {status === 'authenticated' && membershipContext?.clubId && (
                                    <Link to={`/clubs/${membershipContext.clubId}`}
                                        className="inline-flex items-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-3 py-2 text-[11px] font-medium text-[#f4f4f5]">
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

                <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:items-start">
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

                    <section aria-label={t('browseClubs.results')} className={`min-w-0 ${view === 'grid' && !loading && clubs.length > 0 ? '' : 'rounded-xl border border-[#ffffff0d] bg-[#16181d]'}`}>
                        {view === 'list' && (
                            <div className="hidden border-b border-[#ffffff0d] px-4 py-3 text-[11px] font-medium text-[#a1a1aa] lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:gap-4">
                                <span>Club</span>
                                <span>Description</span>
                                <span>Location</span>
                                <span>Structure</span>
                                <span>Actions</span>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-[#16a34a]" /></div>
                        ) : clubs.length === 0 ? (
                            <div className="px-4 py-12 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#ffffff0d] bg-[#0f1117]">
                                    <Building2 className="h-6 w-6 text-[#16a34a]" />
                                </div>
                                <p className="mt-4 text-sm font-semibold text-[#a1a1aa]">
                                    {hasActiveFilters ? t('browseClubs.emptyFiltered') : t('browseClubs.empty')}
                                </p>
                                <Link to="/map" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                                    <MapPin className="h-4 w-4" />
                                    {t('browseClubs.exploreMap')}
                                </Link>
                            </div>
                        ) : view === 'grid' ? (
                            <div className="club-directory-card-grid mx-auto grid w-full max-w-[1800px] gap-4">
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
                            <div className="divide-y divide-[#ffffff0d]">
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

                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    totalElements={pageResult?.totalElements ?? 0}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
                />
            </div>
        </div>
    );
};
