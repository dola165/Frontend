import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Check, ChevronLeft, ChevronRight, Clock, Filter, Loader2, MapPin, Plus, Search, Send, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { createClubApplication, fetchMyClubMembershipContext, selfRegisterClubPlayer } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';

interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    cityName?: string;
    countryName?: string;
    logoUrl?: string;
    joinPolicy?: 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
    relationshipState?: 'NONE' | 'INVITED' | 'APPLIED' | 'TRIALIST' | 'ACTIVE' | 'LEFT' | 'REMOVED';
}

interface PageResult<T> {
    content: T[];
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
}

const CLUB_TYPES = ['PROFESSIONAL', 'GRASSROOTS', 'ACADEMY'] as const;
const JOIN_POLICIES = ['OPEN_TRIAL', 'APPLICATION_REQUIRED', 'INVITE_ONLY'] as const;
const SORT_OPTIONS = [
    { value: 'NEWEST', label: 'Newest' },
    { value: 'NAME', label: 'Name A–Z' },
    { value: 'MEMBER_COUNT', label: 'Most Members' }
] as const;

export const BrowseClubsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { status } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state (synced to URL)
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(searchParams.getAll('type'));
    const [selectedPolicies, setSelectedPolicies] = useState<string[]>(searchParams.getAll('joinPolicy'));
    const [city, setCity] = useState(searchParams.get('city') || '');
    const [country, setCountry] = useState(searchParams.get('country') || '');
    const [sort, setSort] = useState(searchParams.get('sort') || 'NEWEST');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
    const [showFilters, setShowFilters] = useState(false);

    // Data state
    const [pageResult, setPageResult] = useState<PageResult<ClubProfile> | null>(null);
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
            queryParams.set('size', '12');

            const membershipPromise =
                status === 'authenticated'
                    ? fetchMyClubMembershipContext().catch(() => null)
                    : Promise.resolve(null);

            const [clubsResponse, membershipResponse] = await Promise.all([
                apiClient.get<PageResult<ClubProfile>>(`/clubs?${queryParams.toString()}`),
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
    }, [status, search, selectedTypes, selectedPolicies, city, country, sort, page]);

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

    const hasActiveFilters = search || selectedTypes.length > 0 || selectedPolicies.length > 0 || city || country || sort !== 'NEWEST';

    const totalPages = pageResult?.totalPages ?? 0;

    if (loading && clubs.length === 0) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin accent-primary" />
            </div>
        );
    }

    return (
        <div className="bg-base min-h-full">
            <div className="mx-auto flex w-full flex-col gap-6 px-6 py-6 sm:px-8">
                {/* Header */}
                <header className="border-b border-subtle pb-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Destination Page</p>
                            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">Club Directory</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                                Browse clubs as operational records: filter by type, location, join policy, or search by name.
                                {pageResult && ` ${pageResult.totalElements} clubs found.`}
                            </p>
                        </div>

                        <section className="bg-surface border border-subtle px-4 py-4 xl:w-[360px]">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">My Club Workspace</p>
                            <div className="mt-3 flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-subtle bg-base">
                                    <Building2 className="h-4 w-4 accent-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                                        {status === 'authenticated' ? membershipContext?.clubName || 'No club attached' : 'Sign in required'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-secondary">
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
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">Sign In</button>
                                ) : membershipContext?.canCreateClub ? (
                                    <button type="button" onClick={() => navigate('/clubs/create')}
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary">
                                        <Plus className="h-3.5 w-3.5" />Create Club</button>
                                ) : null}
                                {status === 'authenticated' && membershipContext?.clubId && (
                                    <Link to={`/clubs/${membershipContext.clubId}`}
                                        className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                                        Open My Club <ArrowRight className="h-3.5 w-3.5" /></Link>
                                )}
                            </div>
                        </section>
                    </div>
                </header>

                {/* Error / Action Messages */}
                {errorMessage && (
                    <div className="border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{errorMessage}</div>
                )}
                {actionMessage && (
                    <div className={`border px-4 py-3 text-sm font-semibold ${actionMessageType === 'success' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-rose-300/50 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                        {actionMessage}
                    </div>
                )}

                {/* Filter Bar */}
                <div className="bg-surface border border-subtle">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {/* Search */}
                        <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-subtle bg-base px-3 py-2">
                            <Search className="h-4 w-4 text-secondary shrink-0" />
                            <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search clubs..." className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none" />
                            {search && (
                                <button type="button" onClick={() => handleSearchChange('')} className="text-secondary hover:text-primary">
                                    <X className="h-3.5 w-3.5" /></button>
                            )}
                        </div>

                        {/* Sort */}
                        <select value={sort} onChange={(e) => handleSortChange(e.target.value)}
                            className="border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary focus:outline-none">
                            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>

                        {/* Filter Toggle */}
                        <button type="button" onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${showFilters || hasActiveFilters ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-base text-primary'}`}>
                            <Filter className="h-3.5 w-3.5" />
                            Filters
                            {hasActiveFilters && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary text-[9px] text-[color:var(--accent-on-primary)]">!</span>}
                        </button>

                        {hasActiveFilters && (
                            <button type="button" onClick={clearFilters}
                                className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary hover:text-primary">
                                <X className="h-3.5 w-3.5 inline mr-1" />Clear
                            </button>
                        )}
                    </div>

                    {/* Expanded Filter Row */}
                    {showFilters && (
                        <div className="border-t border-subtle px-4 py-4 space-y-4">
                            {/* Club Type */}
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Club Type</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {CLUB_TYPES.map((type) => (
                                        <button key={type} type="button" onClick={() => toggleType(type)}
                                            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] border ${selectedTypes.includes(type) ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-base text-secondary hover:text-primary'}`}>
                                            {type.replace('_', ' ')}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Join Policy */}
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-secondary">Join Policy</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {JOIN_POLICIES.map((policy) => (
                                        <button key={policy} type="button" onClick={() => togglePolicy(policy)}
                                            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] border ${selectedPolicies.includes(policy) ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-base text-secondary hover:text-primary'}`}>
                                            {policy.replace(/_/g, ' ')}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 border border-subtle bg-base px-3 py-2 min-w-[140px]">
                                    <MapPin className="h-4 w-4 text-secondary shrink-0" />
                                    <input type="text" value={city} onChange={(e) => handleCityChange(e.target.value)}
                                        placeholder="City..." className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none w-24" />
                                </div>
                                <div className="flex items-center gap-2 border border-subtle bg-base px-3 py-2 min-w-[140px]">
                                    <span className="text-[10px] font-black text-secondary shrink-0">CC</span>
                                    <input type="text" value={country} onChange={(e) => handleCountryChange(e.target.value)}
                                        placeholder="Country..." className="flex-1 bg-transparent text-sm text-primary placeholder:text-secondary focus:outline-none w-24" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Club Table */}
                <section className="bg-surface border border-subtle">
                    <div className="hidden border-b border-subtle px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-secondary lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:gap-4">
                        <span>Club</span>
                        <span>Description</span>
                        <span>Location</span>
                        <span>Structure</span>
                        <span>Actions</span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin accent-primary" /></div>
                    ) : clubs.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <p className="text-sm font-semibold text-secondary">{hasActiveFilters ? 'No clubs match your filters.' : 'No clubs are available in the directory right now.'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[color:var(--border-subtle)]">
                            {(Array.isArray(clubs) ? clubs : []).map((club) => {
                                const logoUrl = resolveMediaUrl(club.logoUrl);
                                return (
                                    <article key={club.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:items-center">
                                        <div className="min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-subtle bg-base text-sm font-black uppercase text-primary">
                                                    {logoUrl ? <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full object-cover" /> : club.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link to={`/clubs/${club.id}`} className="truncate text-sm font-black uppercase tracking-[0.16em] text-primary hover:underline">{club.name}</Link>
                                                        {club.isOfficial && <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] accent-primary"><ShieldCheck className="h-3.5 w-3.5" />Official</span>}
                                                        {club.joinPolicy && (
                                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                                                                club.joinPolicy === 'OPEN_TRIAL' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                                : club.joinPolicy === 'APPLICATION_REQUIRED' ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                                                : 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300'}`}>
                                                                {club.joinPolicy.replace(/_/g, ' ')}</span>
                                                        )}
                                                        {club.joinPolicy && (
                                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                                                                club.joinPolicy === 'OPEN_TRIAL'
                                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                                    : club.joinPolicy === 'APPLICATION_REQUIRED'
                                                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                                                                    : 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300'
                                                            }`}>
                                                                {club.joinPolicy.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">{club.type}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-sm leading-6 text-secondary">{club.description || 'No club summary provided yet.'}</p>

                                        <div className="text-sm text-secondary">
                                            <div className="inline-flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 accent-primary" />
                                                <span>{club.cityName || club.addressText?.split(',')[0] || 'Location pending'}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                                            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 accent-primary" />{club.memberCount} members</span>
                                            <span>{club.followerCount} followers</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'OPEN_TRIAL' && (
                                                <button type="button" onClick={() => handleJoinClub(club.id)} disabled={joiningClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 border border-accent-primary bg-accent-primary-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60">
                                                    {joiningClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}Join</button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'APPLICATION_REQUIRED' && (
                                                <button type="button" onClick={() => handleApplyClub(club.id)} disabled={applyingClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 border border-accent-primary bg-accent-primary-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60">
                                                    {applyingClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Apply</button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'ACTIVE' && (
                                                <span className="inline-flex items-center gap-1 border border-emerald-600 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3 w-3" />Member</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'APPLIED' && (
                                                <span className="inline-flex items-center gap-1 border border-amber-600 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Clock className="h-3 w-3" />Pending</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'INVITED' && (
                                                <span className="inline-flex items-center gap-1 border border-sky-600 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">Invited</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'TRIALIST' && (
                                                <span className="inline-flex items-center gap-1 border border-purple-600 bg-purple-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">Trialist</span>
                                            )}

                                            <button type="button" onClick={(event) => handleFollowToggle(event, club.id)}
                                                className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${club.isFollowedByMe ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-base text-primary'}`}>
                                                {club.isFollowedByMe ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{club.isFollowedByMe ? 'Following' : 'Follow'}</button>

                                            <Link to={`/clubs/${club.id}`}
                                                className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">Open <ArrowRight className="h-3.5 w-3.5" /></Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-secondary">
                            Page {page + 1} of {totalPages} · {pageResult?.totalElements ?? 0} clubs
                        </p>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                                className="inline-flex items-center gap-1 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary disabled:opacity-40">
                                <ChevronLeft className="h-3.5 w-3.5" />Prev</button>
                            <button type="button" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages}
                                className="inline-flex items-center gap-1 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary disabled:opacity-40">
                                Next<ChevronRight className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
