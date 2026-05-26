import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Map, { Marker, useMap } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ArrowRight, Loader2, LogIn, MapPin, Search, UserPlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface LandingClub {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    addressText?: string | null;
    logoUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

const LANDING_MAP_CENTER = { latitude: 42.3154, longitude: 43.3569 };

function LandingMapFocusController({ club }: { club: LandingClub | null }) {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map || club?.latitude == null || club.longitude == null) {
            return;
        }

        map.flyTo({
            center: [club.longitude, club.latitude],
            zoom: Math.max(map.getZoom(), 9),
            duration: 350
        });
    }, [club?.id, club?.latitude, club?.longitude, map]);

    return null;
}

export const LandingPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, loginWithAccessToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [clubs, setClubs] = useState<LandingClub[]>([]);
    const [isMapLoading, setIsMapLoading] = useState(true);
    const [mapError, setMapError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
    const deferredSearch = useDeferredValue(searchInput);
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');
    const authenticatedRoute = user?.profileComplete ? nextPath : '/onboarding';

    useEffect(() => {
        let active = true;

        const loadClubs = async () => {
            setIsMapLoading(true);
            setMapError(null);

            try {
                const response = await apiClient.get<LandingClub[]>('/clubs');
                if (!active) {
                    return;
                }
                setClubs(Array.isArray(response.data) ? response.data : []);
            } catch (error) {
                if (!active) {
                    return;
                }
                setClubs([]);
                setMapError(extractApiErrorMessage(error, 'Unable to load clubs on the map right now.'));
            } finally {
                if (active) {
                    setIsMapLoading(false);
                }
            }
        };

        void loadClubs();

        return () => {
            active = false;
        };
    }, []);

    const mappedClubs = useMemo(() => {
        return [...clubs]
            .filter((club) => club.latitude != null && club.longitude != null)
            .sort((left, right) => {
                if (left.isOfficial !== right.isOfficial) {
                    return Number(right.isOfficial) - Number(left.isOfficial);
                }
                if (left.followerCount !== right.followerCount) {
                    return right.followerCount - left.followerCount;
                }
                if (left.memberCount !== right.memberCount) {
                    return right.memberCount - left.memberCount;
                }
                return left.name.localeCompare(right.name);
            });
    }, [clubs]);

    const normalizedSearch = deferredSearch.trim().toLowerCase();

    const matchingClubs = useMemo(() => {
        if (!normalizedSearch) {
            return mappedClubs;
        }

        return mappedClubs.filter((club) =>
            [club.name, club.type, club.addressText, club.description]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(normalizedSearch))
        );
    }, [mappedClubs, normalizedSearch]);

    useEffect(() => {
        if (selectedClubId != null || !mappedClubs[0]) {
            return;
        }
        setSelectedClubId(mappedClubs[0].id);
    }, [mappedClubs, selectedClubId]);

    useEffect(() => {
        if (!normalizedSearch || matchingClubs.length === 0) {
            return;
        }
        if (matchingClubs.some((club) => club.id === selectedClubId)) {
            return;
        }
        setSelectedClubId(matchingClubs[0].id);
    }, [matchingClubs, normalizedSearch, selectedClubId]);

    const selectedClub = useMemo(
        () => mappedClubs.find((club) => club.id === selectedClubId) ?? null,
        [mappedClubs, selectedClubId]
    );

    const highlightedClub = useMemo(() => {
        if (normalizedSearch) {
            return matchingClubs.find((club) => club.id === selectedClubId) ?? matchingClubs[0] ?? null;
        }
        return selectedClub ?? mappedClubs[0] ?? null;
    }, [mappedClubs, matchingClubs, normalizedSearch, selectedClub, selectedClubId]);

    const visibleClubs = useMemo(
        () => (normalizedSearch ? matchingClubs : mappedClubs).slice(0, 5),
        [mappedClubs, matchingClubs, normalizedSearch]
    );

    const officialClubCount = useMemo(
        () => clubs.filter((club) => club.isOfficial).length,
        [clubs]
    );

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsLoggingIn(true);
        setAuthError(null);

        try {
            const response = await apiClient.post('/auth/login', {
                email: email.trim(),
                password
            });
            const authenticatedUser = await loginWithAccessToken(response.data.accessToken);
            navigate(authenticatedUser.profileComplete ? nextPath : '/onboarding');
        } catch (error) {
            console.error(error);
            setAuthError(extractApiErrorMessage(error, 'Invalid email or password.'));
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f2f4f7] font-sans text-slate-950 selection:bg-blue-100 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-blue-900/40">
            <header className="border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <Link to={isAuthenticated ? authenticatedRoute : '/'} className="shrink-0">
                        <GrasskickzLogo />
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {isAuthenticated ? (
                            <>
                                <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
                                    Signed in as {user?.fullName || user?.username || 'member'}
                                </span>
                                <Link
                                    to={authenticatedRoute}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#1f6feb] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb]"
                                >
                                    Open workspace
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                                >
                                    Log in
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#1f6feb] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb]"
                                >
                                    Create account
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_380px] lg:items-start lg:py-10">
                <section className="space-y-6">
                    <div className="max-w-3xl">
                        <p className="text-sm font-semibold text-[#1f6feb]">Simple start</p>
                        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
                            Explore clubs on the map, then sign in when you are ready.
                        </h1>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                            We are keeping the first screen familiar on purpose. Open clubs, check locations, and create an account only when you want to follow updates, message people, or build your feed.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                {mappedClubs.length} clubs on the map
                            </div>
                            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                {officialClubCount} verified clubs
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Club map</h2>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        Search a club, move around the map, and open public club pages directly.
                                    </p>
                                </div>

                                <Link
                                    to="/clubs"
                                    className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Browse club directory
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="mt-4 flex flex-col gap-3">
                                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#1f6feb] focus-within:bg-white dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-[#4c8dff]">
                                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        placeholder="Search a club or city"
                                        className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                                    />
                                </label>

                                {normalizedSearch && matchingClubs.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {matchingClubs.slice(0, 5).map((club) => (
                                            <button
                                                key={club.id}
                                                type="button"
                                                onClick={() => setSelectedClubId(club.id)}
                                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                                    highlightedClub?.id === club.id
                                                        ? 'border-[#1f6feb] bg-blue-50 text-[#1957bb] dark:bg-blue-500/10 dark:text-[#82aefc]'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {club.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
                            <div className="h-[380px] min-h-[320px] border-b border-slate-200 dark:border-slate-800 lg:h-[500px] lg:border-b-0 lg:border-r">
                                {isMapLoading ? (
                                    <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-7 w-7 animate-spin" />
                                            <p className="text-sm font-medium">Loading map...</p>
                                        </div>
                                    </div>
                                ) : mapError ? (
                                    <div className="flex h-full items-center justify-center bg-slate-50 px-6 text-center text-sm leading-6 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                        {mapError}
                                    </div>
                                ) : mappedClubs.length === 0 ? (
                                    <div className="flex h-full items-center justify-center bg-slate-50 px-6 text-center text-sm leading-6 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                        Clubs will appear here as soon as they add their locations.
                                    </div>
                                ) : (
                                    <Map
                                        mapboxAccessToken={MAPBOX_TOKEN}
                                        initialViewState={{
                                            ...LANDING_MAP_CENTER,
                                            zoom: 7
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        mapStyle="mapbox://styles/mapbox/dark-v11"
                                        scrollZoom={true}
                                    >
                                        <LandingMapFocusController club={highlightedClub} />
                                        {mappedClubs.map((club) => {
                                            const isHighlighted = highlightedClub?.id === club.id;
                                            return (
                                                <Marker
                                                    key={club.id}
                                                    longitude={club.longitude!}
                                                    latitude={club.latitude!}
                                                    anchor="bottom"
                                                    onClick={() => setSelectedClubId(club.id)}
                                                >
                                                    <div className={`talanti-map-marker talanti-map-marker--club ${isHighlighted ? 'is-selected' : ''}`}>
                                                        <div className="talanti-map-marker__blip" />
                                                    </div>
                                                </Marker>
                                            );
                                        })}
                                    </Map>
                                )}
                            </div>
                            <div className="flex flex-col px-5 py-5">
                                <div>
                                    <p className="text-sm font-semibold text-slate-950 dark:text-white">Visible clubs</p>
                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                        {normalizedSearch ? 'Search results on the map.' : 'A few clubs to get started.'}
                                    </p>
                                </div>

                                <div className="mt-4 flex-1 space-y-3">
                                    {visibleClubs.length > 0 ? (
                                        visibleClubs.map((club) => {
                                            const logoUrl = resolveMediaUrl(club.logoUrl);
                                            const isActive = highlightedClub?.id === club.id;

                                            return (
                                                <div
                                                    key={club.id}
                                                    className={`rounded-2xl border p-3 transition-colors ${
                                                        isActive
                                                            ? 'border-[#1f6feb] bg-blue-50 dark:bg-blue-500/10'
                                                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedClubId(club.id)}
                                                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                                        >
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold uppercase text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                                {logoUrl ? (
                                                                    <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    club.name.slice(0, 2)
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                                                    {club.name}
                                                                </p>
                                                                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                                                    {club.type || 'Club profile'}
                                                                </p>
                                                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                                                    {club.addressText || club.description || 'Location details are being added.'}
                                                                </p>
                                                            </div>
                                                        </button>

                                                        <Link
                                                            to={`/clubs/${club.id}`}
                                                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            aria-label={`Open ${club.name}`}
                                                        >
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Link>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {club.isOfficial ? (
                                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                                Verified
                                                            </span>
                                                        ) : null}
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                                            {club.followerCount} followers
                                                        </span>
                                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                                            {club.memberCount} members
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                            No clubs matched that search yet.
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6feb]" />
                                        <p>
                                            You can browse the map without an account. Sign in only when you want follows, feed updates, messages, or club tools.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="lg:sticky lg:top-8">
                    {isAuthenticated ? (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-sm font-semibold text-[#1f6feb]">Welcome back</p>
                            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                                {user?.fullName || user?.username || 'Continue'}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {user?.profileComplete
                                    ? 'Your account is ready. Go straight into your feed and club workspace.'
                                    : 'Finish setting up your account before you start using the feed and club tools.'}
                            </p>

                            <div className="mt-6 space-y-3">
                                <Link
                                    to={authenticatedRoute}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6feb] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb]"
                                >
                                    {user?.profileComplete ? 'Open workspace' : 'Finish setup'}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    to="/clubs"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Browse clubs
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">Log in</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                Sign in to follow clubs, open your feed, and keep your messages in one place.
                            </p>

                            {authError ? (
                                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300">
                                    {authError}
                                </div>
                            ) : null}

                            <form onSubmit={handleLogin} className="mt-6 space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            Password
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            className="text-sm font-medium text-[#1f6feb] hover:underline"
                                        >
                                            Forgot password?
                                        </Link>
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="Password"
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-[#1f6feb] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6feb] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1957bb] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                    Log in
                                </button>
                            </form>

                            <div className="my-6 h-px bg-slate-200 dark:bg-slate-800" />

                            <Link
                                to="/signup"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <UserPlus className="h-4 w-4" />
                                Create new account
                            </Link>

                            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Players, parents, supporters, and future club admins all start with the same simple account flow.
                            </p>
                        </div>
                    )}
                </aside>
            </main>

            <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
                    <p>Grasskickz helps people discover clubs and opportunities without unnecessary friction.</p>
                    <div className="flex flex-wrap gap-4">
                        <Link to="/clubs" className="hover:text-slate-900 dark:hover:text-white">Clubs</Link>
                        <Link to="/login" className="hover:text-slate-900 dark:hover:text-white">Log in</Link>
                        <Link to="/signup" className="hover:text-slate-900 dark:hover:text-white">Create account</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
