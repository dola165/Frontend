import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl, useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowRight, Loader2, LogIn, MapPin, Search, UserPlus } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const LANDING_MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

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
                const response = await apiClient.get<LandingClub[]>('/clubs?size=100&sort=NAME');
                if (!active) {
                    return;
                }
                // Handle both PageResult and legacy List response formats
                const data = response.data;
                setClubs(Array.isArray(data) ? data : (data as { content: LandingClub[] })?.content ?? []);
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
        () => (normalizedSearch ? matchingClubs : mappedClubs).slice(0, 4),
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
        <div className="min-h-screen bg-[#0f1117] text-[#f4f4f5]">
            <header className="border-b border-[#ffffff0d] bg-[#0f1117] backdrop-blur">
                <div className="mx-auto flex w-full items-center justify-between gap-4 px-6 py-3 sm:px-8">
                    <Link to={isAuthenticated ? authenticatedRoute : '/'} className="shrink-0">
                        <GrasskickzLogo />
                    </Link>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {isAuthenticated ? (
                            <>
                                <span className="hidden text-sm text-[#a1a1aa] sm:inline">
                                    Signed in as {user?.fullName || user?.username || 'member'}
                                </span>
                                <Link
                                    to={authenticatedRoute}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e]"
                                >
                                    Open workspace
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="rounded-xl px-4 py-2 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]"
                                >
                                    Log in
                                </Link>
                                <Link
                                    to="/signup"
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e]"
                                >
                                    Create account
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto grid w-full gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.45fr)_340px] lg:items-start lg:py-8">
                <section className="space-y-4">
                    <div className="max-w-3xl">
                        <p className="text-sm font-semibold text-[#16a34a]">Simple start</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#f4f4f5] sm:text-4xl">
                            Explore clubs on the map, then sign in when you are ready.
                        </h1>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-[#a1a1aa]">
                            We are keeping the first screen familiar on purpose. Open clubs, check locations, and create an account only when you want to follow updates, message people, or build your feed.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                            <div className="rounded-full border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm text-[#f4f4f5]">
                                {mappedClubs.length} clubs on the map
                            </div>
                            <div className="rounded-full border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm text-[#f4f4f5]">
                                {officialClubCount} verified clubs
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#ffffff0d] bg-[#16181d]">
                        <div className="border-b border-[#ffffff0d] px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-[#f4f4f5]">Club map</h2>
                                    <p className="mt-0.5 text-sm text-[#a1a1aa]">
                                        Search a club, move around the map, and open public club pages directly.
                                    </p>
                                </div>

                                <Link
                                    to="/clubs"
                                    className="inline-flex items-center gap-2 self-start rounded-xl border border-[#ffffff0d] px-4 py-2 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]"
                                >
                                    Browse club directory
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="mt-4 flex flex-col gap-3">
                                <label className="flex items-center gap-3 rounded-xl border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 focus-within:border-[#16a34a]">
                                    <Search className="h-4 w-4 shrink-0 text-[#a1a1aa]" />
                                    <input
                                        type="text"
                                        value={searchInput}
                                        onChange={(event) => setSearchInput(event.target.value)}
                                        placeholder="Search a club or city"
                                        className="w-full bg-transparent text-sm text-[#f4f4f5] outline-none placeholder:text-[#a1a1aa]"
                                    />
                                </label>

                                {normalizedSearch && matchingClubs.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {matchingClubs.slice(0, 4).map((club) => (
                                            <button
                                                key={club.id}
                                                type="button"
                                                onClick={() => setSelectedClubId(club.id)}
                                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                                    highlightedClub?.id === club.id
                                                        ? 'border-[#16a34a] bg-[#16a34a]/10 text-[#16a34a]'
                                                        : 'border-[#ffffff0d] bg-[#16181d] text-[#a1a1aa] hover:bg-[#1a1c22]'
                                                }`}
                                            >
                                                {club.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-[minmax(0,1fr)_272px]">
                            <div className="relative min-h-[380px] border-b border-[#ffffff0d] lg:min-h-0 lg:border-b-0 lg:border-r">
                                {isMapLoading ? (
                                    <div className="flex h-full min-h-[380px] items-center justify-center bg-[#0f1117] text-[#a1a1aa]">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-7 w-7 animate-spin" />
                                            <p className="text-sm font-medium">Loading map...</p>
                                        </div>
                                    </div>
                                ) : mapError ? (
                                    <div className="flex h-full min-h-[380px] items-center justify-center bg-[#0f1117] px-6 text-center text-sm leading-6 text-[#a1a1aa]">
                                        {mapError}
                                    </div>
                                ) : mappedClubs.length === 0 ? (
                                    <div className="flex h-full min-h-[380px] items-center justify-center bg-[#0f1117] px-6 text-center text-sm leading-6 text-[#a1a1aa]">
                                        Clubs will appear here as soon as they add their locations.
                                    </div>
                                ) : (
                                    <Map
                                        initialViewState={{
                                            ...LANDING_MAP_CENTER,
                                            zoom: 7,
                                            pitch: 45,
                                            bearing: -17
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                        mapStyle={LANDING_MAP_STYLE}
                                        scrollZoom={true}
                                    >
                                        <LandingMapFocusController club={highlightedClub} />
                                        <NavigationControl position="bottom-right" />
                                        <GeolocateControl
                                            position="bottom-right"
                                            positionOptions={{ enableHighAccuracy: true }}
                                            trackUserLocation={true}
                                        />
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
                            <div className="flex flex-col px-4 py-4">
                                <div>
                                    <p className="text-sm font-semibold text-[#f4f4f5]">Visible clubs</p>
                                    <p className="mt-0.5 text-xs text-[#a1a1aa]">
                                        {normalizedSearch ? 'Search results on the map.' : 'A few clubs to get started.'}
                                    </p>
                                </div>

                                <div className="mt-3 flex-1 space-y-2">
                                    {visibleClubs.length > 0 ? (
                                        visibleClubs.map((club) => {
                                            const logoUrl = resolveMediaUrl(club.logoUrl);
                                            const isActive = highlightedClub?.id === club.id;

                                            return (
                                                <div
                                                    key={club.id}
                                                    className={`rounded-xl border p-2.5 transition-colors ${
                                                        isActive
                                                            ? 'border-[#16a34a] bg-[#16a34a]/10'
                                                            : 'border-[#ffffff0d] bg-[#0f1117]'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedClubId(club.id)}
                                                            className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                                                        >
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffffff0d] bg-[#16181d] text-[10px] font-semibold uppercase text-[#f4f4f5]">
                                                                {logoUrl ? (
                                                                    <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    club.name.slice(0, 2)
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-[#f4f4f5]">
                                                                    {club.name}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">
                                                                    {club.type || 'Club profile'}
                                                                </p>
                                                                <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#a1a1aa]">
                                                                    {club.addressText || club.description || 'Location details are being added.'}
                                                                </p>
                                                            </div>
                                                        </button>

                                                        <Link
                                                            to={`/clubs/${club.id}`}
                                                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#ffffff0d] bg-[#16181d] text-[#a1a1aa] transition-colors hover:bg-[#1a1c22] hover:text-[#f4f4f5]"
                                                            aria-label={`Open ${club.name}`}
                                                        >
                                                            <ArrowRight className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[#a1a1aa]">
                                                        {club.isOfficial ? (
                                                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                                                                Verified
                                                            </span>
                                                        ) : null}
                                                        <span className="rounded-full bg-[#0f1117] px-2 py-0.5 ring-1 ring-inset ring-[#ffffff0d]">
                                                            {club.followerCount} followers
                                                        </span>
                                                        <span className="rounded-full bg-[#0f1117] px-2 py-0.5 ring-1 ring-inset ring-[#ffffff0d]">
                                                            {club.memberCount} members
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-[#ffffff0d] px-4 py-6 text-sm text-[#a1a1aa]">
                                            No clubs matched that search yet.
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 rounded-xl bg-[#0f1117] px-3 py-3 text-xs leading-5 text-[#a1a1aa]">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
                                        <p>
                                            Browse the map without an account. Sign in when you want follows, feed updates, messages, or club tools.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="lg:sticky lg:top-8">
                    {isAuthenticated ? (
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-6">
                            <p className="text-sm font-semibold text-[#16a34a]">Welcome back</p>
                            <h2 className="mt-2 text-2xl font-semibold text-[#f4f4f5]">
                                {user?.fullName || user?.username || 'Continue'}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">
                                {user?.profileComplete
                                    ? 'Your account is ready. Go straight into your feed and club workspace.'
                                    : 'Finish setting up your account before you start using the feed and club tools.'}
                            </p>

                            <div className="mt-6 space-y-3">
                                <Link
                                    to={authenticatedRoute}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e]"
                                >
                                    {user?.profileComplete ? 'Open workspace' : 'Finish setup'}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    to="/clubs"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#ffffff0d] px-4 py-3 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]"
                                >
                                    Browse clubs
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-6">
                            <h2 className="text-2xl font-semibold text-[#f4f4f5]">Log in</h2>
                            <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">
                                Sign in to follow clubs, open your feed, and keep your messages in one place.
                            </p>

                            {authError ? (
                                <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                                    {authError}
                                </div>
                            ) : null}

                            <form onSubmit={handleLogin} className="mt-6 space-y-4">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-[#f4f4f5]">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="you@example.com"
                                        required
                                        className="w-full rounded-xl border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a]"
                                    />
                                </div>

                                <div>
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <label className="text-sm font-medium text-[#f4f4f5]">
                                            Password
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            className="text-sm font-medium text-[#16a34a] hover:underline"
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
                                        className="w-full rounded-xl border border-[#ffffff0d] bg-[#0f1117] px-4 py-3 text-sm text-[#f4f4f5] outline-none transition-colors focus:border-[#16a34a]"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                                    Log in
                                </button>
                            </form>

                            <div className="my-6 h-px bg-[#ffffff0d]" />

                            <Link
                                to="/signup"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#ffffff0d] px-4 py-3 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]"
                            >
                                <UserPlus className="h-4 w-4" />
                                Create new account
                            </Link>

                            <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">
                                Players, parents, supporters, and future club admins all start with the same simple account flow.
                            </p>
                        </div>
                    )}
                </aside>
            </main>

            <footer className="border-t border-[#ffffff0d] bg-[#16181d]">
                <div className="mx-auto flex w-full flex-col gap-2 px-6 py-3 text-xs text-[#a1a1aa] sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <p>Grasskickz helps people discover clubs and opportunities without unnecessary friction.</p>
                    <div className="flex flex-wrap gap-4">
                        <Link to="/clubs" className="hover:text-[#f4f4f5]">Clubs</Link>
                        <Link to="/login" className="hover:text-[#f4f4f5]">Log in</Link>
                        <Link to="/signup" className="hover:text-[#f4f4f5]">Create account</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};
