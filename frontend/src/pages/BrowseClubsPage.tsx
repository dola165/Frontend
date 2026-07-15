import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, Check, Clock, Filter, Loader2, MapPin, Plus, Search, Send, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { createClubApplication, fetchMyClubMembershipContext, selfRegisterClubPlayer } from '../features/clubs/api';
import { PaginationBar } from '../components/ui/PaginationBar';
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
    const [pageSize, setPageSize] = useState(12);
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
            queryParams.set('size', String(pageSize));

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
    }, [status, search, selectedTypes, selectedPolicies, city, country, sort, page, pageSize]);

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
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin text-[#16a34a]" />
            </div>
        );
    }

    return (
        <div className="bg-[#0f1117] min-h-full">
            <div className="mx-auto flex w-full flex-col gap-6 px-6 py-6 sm:px-8">
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

                {/* Filter Bar */}
                <div className="rounded-xl bg-[#16181d] border border-[#ffffff0d]">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {/* Search */}
                        <div className="flex min-w-[200px] flex-1 items-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-3 py-2">
                            <Search className="h-4 w-4 text-[#a1a1aa] shrink-0" />
                            <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search clubs..." className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none" />
                            {search && (
                                <button type="button" onClick={() => handleSearchChange('')} className="text-[#a1a1aa] hover:text-[#f4f4f5]">
                                    <X className="h-3.5 w-3.5" /></button>
                            )}
                        </div>

                        {/* Sort */}
                        <select value={sort} onChange={(e) => handleSortChange(e.target.value)}
                            className="rounded-xl border border-[#ffffff0d] bg-[#16181d] px-3 py-1.5 text-sm font-medium text-[#f4f4f5] focus:outline-none">
                            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>

                        {/* Filter Toggle */}
                        <button type="button" onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-medium ${showFilters || hasActiveFilters ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]' : 'border-[#ffffff0d] bg-[#0f1117] text-[#f4f4f5]'}`}>
                            <Filter className="h-3.5 w-3.5" />
                            Filters
                            {hasActiveFilters && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#16a34a] text-[9px] text-white">!</span>}
                        </button>

                        {hasActiveFilters && (
                            <button type="button" onClick={clearFilters}
                                className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#f4f4f5]">
                                <X className="h-3.5 w-3.5 inline mr-1" />Clear
                            </button>
                        )}
                    </div>

                    {/* Expanded Filter Row */}
                    {showFilters && (
                        <div className="border-t border-[#ffffff0d] px-4 py-4 space-y-4">
                            {/* Club Type */}
                            <div>
                                <span className="text-[10px] font-medium text-[#a1a1aa]">Club Type</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {CLUB_TYPES.map((type) => (
                                        <button key={type} type="button" onClick={() => toggleType(type)}
                                            className={`px-3 py-1.5 text-[11px] font-medium border ${selectedTypes.includes(type) ? 'bg-[#16a34a]/10 border-[#16a34a] text-[#16a34a]' : 'border-[#ffffff0d] text-[#a1a1aa]'}`}>
                                            {type.replace('_', ' ')}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Join Policy */}
                            <div>
                                <span className="text-[10px] font-medium text-[#a1a1aa]">Join Policy</span>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {JOIN_POLICIES.map((policy) => (
                                        <button key={policy} type="button" onClick={() => togglePolicy(policy)}
                                            className={`px-3 py-1.5 text-[11px] font-medium border ${selectedPolicies.includes(policy) ? 'bg-[#16a34a]/10 border-[#16a34a] text-[#16a34a]' : 'border-[#ffffff0d] text-[#a1a1aa]'}`}>
                                            {policy.replace(/_/g, ' ')}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-3 py-2 min-w-[140px]">
                                    <MapPin className="h-4 w-4 text-[#a1a1aa] shrink-0" />
                                    <input type="text" value={city} onChange={(e) => handleCityChange(e.target.value)}
                                        placeholder="City..." className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none w-24" />
                                </div>
                                <div className="flex items-center gap-2 border border-[#ffffff0d] bg-[#0f1117] px-3 py-2 min-w-[140px]">
                                    <span className="text-[10px] font-medium text-[#a1a1aa] shrink-0">CC</span>
                                    <input type="text" value={country} onChange={(e) => handleCountryChange(e.target.value)}
                                        placeholder="Country..." className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#a1a1aa] focus:outline-none w-24" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Club Table */}
                <section className="rounded-xl bg-[#16181d] border border-[#ffffff0d]">
                    <div className="hidden border-b border-[#ffffff0d] px-4 py-3 text-[11px] font-medium text-[#a1a1aa] lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:gap-4">
                        <span>Club</span>
                        <span>Description</span>
                        <span>Location</span>
                        <span>Structure</span>
                        <span>Actions</span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-[#16a34a]" /></div>
                    ) : clubs.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <p className="text-sm font-semibold text-[#a1a1aa]">{hasActiveFilters ? 'No clubs match your filters.' : 'No clubs are available in the directory right now.'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#ffffff0d]">
                            {(Array.isArray(clubs) ? clubs : []).map((club) => {
                                const logoUrl = resolveMediaUrl(club.logoUrl);
                                return (
                                    <article key={club.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:items-center">
                                        <div className="min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#ffffff0d] bg-[#0f1117] text-sm font-semibold text-[#f4f4f5]">
                                                    {logoUrl ? <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full object-cover" /> : club.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link to={`/clubs/${club.id}`} className="truncate text-sm text-[#f4f4f5] font-semibold hover:text-[#16a34a]">{club.name}</Link>
                                                        {club.isOfficial && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#16a34a]"><ShieldCheck className="h-3.5 w-3.5" />Official</span>}
                                                        {club.joinPolicy && (
                                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${
                                                                club.joinPolicy === 'OPEN_TRIAL' ? 'bg-emerald-500/10 text-emerald-400'
                                                                : club.joinPolicy === 'APPLICATION_REQUIRED' ? 'bg-amber-500/10 text-amber-400'
                                                                : 'bg-violet-500/10 text-violet-400'}`}>
                                                                {club.joinPolicy.replace(/_/g, ' ')}</span>
                                                        )}
                                                        {club.joinPolicy && (
                                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-medium ${
                                                                club.joinPolicy === 'OPEN_TRIAL'
                                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                                    : club.joinPolicy === 'APPLICATION_REQUIRED'
                                                                    ? 'bg-amber-500/10 text-amber-400'
                                                                    : 'bg-violet-500/10 text-violet-400'
                                                            }`}>
                                                                {club.joinPolicy.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-[11px] font-medium text-[#a1a1aa]">{club.type}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-sm leading-6 text-[#a1a1aa]">{club.description || 'No club summary provided yet.'}</p>

                                        <div className="text-sm text-[#a1a1aa]">
                                            <div className="inline-flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-[#16a34a]" />
                                                <span>{club.cityName || club.addressText?.split(',')[0] || 'Location pending'}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#a1a1aa]">
                                            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-[#16a34a]" />{club.memberCount} members</span>
                                            <span>{club.followerCount} followers</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'OPEN_TRIAL' && (
                                                <button type="button" onClick={() => handleJoinClub(club.id)} disabled={joiningClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium bg-[#16a34a] text-white disabled:opacity-60">
                                                    {joiningClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}Join</button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'APPLICATION_REQUIRED' && (
                                                <button type="button" onClick={() => handleApplyClub(club.id)} disabled={applyingClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium bg-[#16a34a] text-white disabled:opacity-60">
                                                    {applyingClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Apply</button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'ACTIVE' && (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-400"><Check className="h-3 w-3" />Member</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'APPLIED' && (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-amber-500/10 text-amber-400"><Clock className="h-3 w-3" />Pending</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'INVITED' && (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-sky-500/10 text-sky-400">Invited</span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'TRIALIST' && (
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-violet-500/10 text-violet-400">Trialist</span>
                                            )}

                                            <button type="button" onClick={(event) => handleFollowToggle(event, club.id)}
                                                className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-medium rounded-xl ${
                                                    club.isFollowedByMe
                                                        ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]'
                                                        : 'border-[#ffffff0d] bg-[#0f1117] text-[#f4f4f5]'
                                                }`}>
                                                {club.isFollowedByMe ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{club.isFollowedByMe ? 'Following' : 'Follow'}</button>

                                            <Link to={`/clubs/${club.id}`}
                                                className="inline-flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium text-[#16a34a]">Open <ArrowRight className="h-3.5 w-3.5" /></Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

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
