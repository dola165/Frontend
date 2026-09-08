import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    CircleDot,
    Compass,
    Loader2,
    LogIn,
    MapPin,
    MessageCircle,
    Trophy,
    UserPlus,
    UsersRound
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import { GrasskickzLogo } from '../components/layout/GrasskickzLogo';
import { LandingCommandPalette, type LandingCommandAction } from '../components/landing/LandingCommandPalette';
import { LandingParallax } from '../components/landing/LandingParallax';
import { LandingPlayground } from '../components/landing/LandingPlayground';
import { LandingReveal } from '../components/landing/LandingReveal';
import { MapExperience } from '../components/map/MapExperience';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolvePostAuthRedirect } from '../utils/authRedirect';

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

const landingPillars = [
    {
        number: '01',
        icon: Compass,
        title: 'Discover the right place',
        body: 'Explore clubs and football locations by area, then open the public profile that feels right for you.',
        tone: 'text-[#7dd3fc]',
        background: 'bg-[#7dd3fc]/10'
    },
    {
        number: '02',
        icon: MessageCircle,
        title: 'Stay close to the action',
        body: 'Follow clubs, keep up with posts, message people, and find the opportunities happening around the game.',
        tone: 'text-[#c4b5fd]',
        background: 'bg-[#c4b5fd]/10'
    },
    {
        number: '03',
        icon: Building2,
        title: 'Build what comes next',
        body: 'Club owners and staff can manage people, squads, schedules, tournaments, and the work behind the badge.',
        tone: 'text-[#86efac]',
        background: 'bg-[#86efac]/10'
    }
] as const;

const landingAudiences = [
    {
        icon: UsersRound,
        title: 'Players & families',
        body: 'Find clubs, teams, schedules, and a clearer next step in your football journey.'
    },
    {
        icon: CalendarDays,
        title: 'Club owners & coaches',
        body: 'Keep players, squads, training, matches, tryouts, and tournaments in one working space.'
    },
    {
        icon: UsersRound,
        title: 'Fans & supporters',
        body: 'Follow clubs, see the story behind them, and stay connected to the people around the game.'
    }
] as const;

const landingCapabilities = [
    {
        icon: MapPin,
        title: 'Discover clubs by place',
        body: 'Search the map by country, city, or club name and open a public profile before you ever need an account.',
        tone: 'text-[#7dd3fc]',
        background: 'bg-[#7dd3fc]/10'
    },
    {
        icon: MessageCircle,
        title: 'Follow the story',
        body: 'Keep club updates, conversations, and the people around the game close to the same football home.',
        tone: 'text-[#c4b5fd]',
        background: 'bg-[#c4b5fd]/10'
    },
    {
        icon: BriefcaseBusiness,
        title: 'Find ways to help',
        body: 'Preview real roles and volunteer opportunities published by clubs when you are ready to get involved.',
        tone: 'text-[#facc15]',
        background: 'bg-[#facc15]/10'
    },
    {
        icon: Building2,
        title: 'Run the work behind the badge',
        body: 'Club teams can bring people, squads, schedules, tournaments, and day-to-day operations into one workspace.',
        tone: 'text-[#86efac]',
        background: 'bg-[#86efac]/10'
    }
] as const;

export const LandingPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, loginWithAccessToken } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [clubs, setClubs] = useState<LandingClub[]>([]);
    const [playgroundActive, setPlaygroundActive] = useState(false);
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), '/feed');
    const authenticatedRoute = user?.profileComplete ? nextPath : '/onboarding';

    const scrollTo = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const scrollToMap = useCallback(() => {
        document.querySelector<HTMLElement>('[data-landing-map]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const commandActions = useMemo<LandingCommandAction[]>(() => [
        {
            id: 'world',
            label: 'Explore GrassKickZ World',
            description: 'Open the full public football map.',
            icon: Compass,
            keywords: ['map', 'clubs', 'locations'],
            onSelect: () => navigate('/world')
        },
        {
            id: 'find-club',
            label: 'Find a club or city',
            description: 'Jump back to the landing-page map search.',
            icon: MapPin,
            keywords: ['search', 'location', 'map'],
            onSelect: scrollToMap
        },
        {
            id: 'clubs',
            label: 'Browse clubs',
            description: 'See the public club directory.',
            icon: Building2,
            keywords: ['directory', 'teams'],
            onSelect: () => navigate('/clubs')
        },
        {
            id: 'tournaments',
            label: 'Preview tournaments',
            description: 'Explore the current competition preview.',
            icon: Trophy,
            keywords: ['competitions', 'events'],
            onSelect: () => navigate('/tournaments')
        },
        {
            id: 'jobs',
            label: 'Preview jobs and volunteering',
            description: 'Explore roles published by football clubs.',
            icon: BriefcaseBusiness,
            keywords: ['work', 'volunteer', 'opportunities'],
            onSelect: () => navigate('/jobs')
        },
        {
            id: 'how-it-works',
            label: 'How GrassKickZ works',
            description: 'See the three steps after the map.',
            icon: Compass,
            keywords: ['intro', 'steps'],
            onSelect: () => scrollTo('landing-pillars')
        },
        {
            id: 'audiences',
            label: 'Find your starting point',
            description: 'See how each football role can use GrassKickZ.',
            icon: UsersRound,
            keywords: ['players', 'coaches', 'fans'],
            onSelect: () => scrollTo('landing-audiences')
        },
        {
            id: 'playground',
            label: playgroundActive ? 'Close playground' : 'Open playground',
            description: playgroundActive ? 'Return to the quiet landing page.' : 'Try the optional football physics layer.',
            icon: CircleDot,
            keywords: ['balls', 'physics', 'play'],
            onSelect: () => setPlaygroundActive((current) => !current)
        },
        {
            id: 'login',
            label: 'Log in',
            description: 'Open your GrassKickZ account.',
            icon: LogIn,
            onSelect: () => navigate('/login')
        },
        {
            id: 'signup',
            label: 'Create an account',
            description: 'Start following clubs and building your football space.',
            icon: UserPlus,
            onSelect: () => navigate('/signup')
        }
    ], [navigate, playgroundActive, scrollTo, scrollToMap]);

    useEffect(() => {
        let active = true;

        const loadClubs = async () => {
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
                // The shared map owns its own loading/error state. This request only
                // powers the live count chips above it, so a count failure should not
                // make the public map unusable.
                console.warn('Unable to load landing-page club counts', error);
            }
        };

        void loadClubs();

        return () => {
            active = false;
        };
    }, []);

    const mappedClubCount = clubs.filter((club) => club.latitude != null && club.longitude != null).length;
    const officialClubCount = clubs.filter((club) => club.isOfficial).length;

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
                        <LandingCommandPalette actions={commandActions} />
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
                    <div className="max-w-3xl" data-bounce-surface="intro-heading">
                        <p className="text-sm font-semibold text-[#16a34a]">Simple start</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#f4f4f5] sm:text-4xl">
                            Explore clubs on the map, then sign in when you are ready.
                        </h1>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-[#a1a1aa]">
                            We are keeping the first screen familiar on purpose. Open clubs, check locations, and create an account only when you want to follow updates, message people, or build your feed.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-3">
                            <div className="rounded-full border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm text-[#f4f4f5]">
                                {mappedClubCount} clubs on the map
                            </div>
                            <div className="rounded-full border border-[#ffffff0d] bg-[#16181d] px-4 py-2 text-sm text-[#f4f4f5]">
                                {officialClubCount} verified clubs
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#ffffff0d] bg-[#16181d]" data-landing-map data-bounce-surface="map-card">
                        <div className="border-b border-[#ffffff0d] px-4 py-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-[#f4f4f5]">Club map</h2>
                                    <p className="mt-0.5 text-sm text-[#a1a1aa]">
                                        Search a club or city, move around the map, and open public club pages directly.
                                    </p>
                                </div>

                                <Link
                                    to="/world"
                                    className="inline-flex items-center gap-2 self-start rounded-xl border border-[#ffffff0d] px-4 py-2 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]"
                                >
                                    Explore GrassKickZ World
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>

                        <div className="min-h-[560px] border-b border-[#ffffff0d] sm:min-h-[620px] lg:min-h-[700px]">
                            <MapExperience
                                darkMode={false}
                                context="guest"
                                allowedEntityTypes={['CLUB']}
                                mapTheme="dark"
                                filterLayout="external"
                                embedded
                            />
                        </div>
                    </div>
                </section>

                <aside className="lg:sticky lg:top-8">
                    {isAuthenticated ? (
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-6" data-bounce-surface="welcome-card">
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
                        <div className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-6" data-bounce-surface="login-card">
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

            <LandingReveal>
                <section id="landing-pillars" className="relative overflow-hidden border-t border-[#ffffff0d] bg-[#0f1117] px-6 py-14 sm:px-8 lg:py-20" aria-labelledby="landing-pillars-title">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                        <LandingParallax depth={0.1} className="absolute -right-10 top-16 h-40 w-40 rounded-full border border-[#16a34a]/10 bg-[#16a34a]/[0.03]" />
                        <LandingParallax depth={-0.08} className="absolute left-[42%] top-1/2 h-24 w-24 rounded-full border border-[#7dd3fc]/10 bg-[#7dd3fc]/[0.02]" />
                    </div>
                    <div className="relative z-10 mx-auto max-w-[1400px]">
                    <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#16a34a]">After the map</p>
                        <h2 id="landing-pillars-title" className="mt-2 text-2xl font-bold tracking-tight text-[#f4f4f5] sm:text-3xl">
                            One place for the football work around every club.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[#a1a1aa] sm:text-base">
                            Start with a location and a club. When you are ready for more, GrassKickZ keeps discovery, community, and club operations connected without making the first step feel complicated.
                        </p>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {landingPillars.map((pillar) => (
                            <article key={pillar.number} data-bounce-surface={`pillar-${pillar.number}`} className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pillar.background}`}>
                                        <pillar.icon className={`h-5 w-5 ${pillar.tone}`} />
                                    </div>
                                    <span className="text-xs font-semibold tracking-[0.16em] text-[#71717a]">{pillar.number}</span>
                                </div>
                                <h3 className="mt-5 text-base font-semibold text-[#f4f4f5]">{pillar.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{pillar.body}</p>
                            </article>
                        ))}
                    </div>
                    </div>
                </section>
            </LandingReveal>

            <LandingReveal delayMs={60}>
                <section id="landing-audiences" className="relative overflow-hidden border-t border-[#ffffff0d] bg-[#111318] px-6 py-14 sm:px-8 lg:py-20" aria-labelledby="landing-audiences-title">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                        <LandingParallax depth={0.14} className="absolute -left-16 top-12 h-48 w-48 rounded-full border border-[#c4b5fd]/10 bg-[#c4b5fd]/[0.02]" />
                    </div>
                    <div className="relative z-10 mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-16">
                    <div className="max-w-md">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#16a34a]">A shared starting point</p>
                        <h2 id="landing-audiences-title" className="mt-2 text-2xl font-bold tracking-tight text-[#f4f4f5] sm:text-3xl">
                            Different roles. One football community.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">
                            GrassKickZ is designed to be useful whether you are looking for a club, running one, representing players, or simply staying close to the game.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {landingAudiences.map((audience) => (
                            <article key={audience.title} data-bounce-surface={`audience-${audience.title.toLocaleLowerCase().replaceAll(' ', '-')}`} className="flex gap-4 rounded-xl border border-[#ffffff0d] bg-[#16181d] p-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ffffff0d] bg-[#0f1117] text-[#16a34a]">
                                    <audience.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-[#f4f4f5]">{audience.title}</h3>
                                    <p className="mt-1.5 text-sm leading-5 text-[#a1a1aa]">{audience.body}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                    </div>
                </section>
            </LandingReveal>

            <LandingReveal delayMs={90}>
                <section id="landing-capabilities" className="relative overflow-hidden border-t border-[#ffffff0d] bg-[#0f1117] px-6 py-14 sm:px-8 lg:py-20" aria-labelledby="landing-capabilities-title">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                        <LandingParallax depth={-0.12} className="absolute right-[18%] top-20 h-28 w-28 rounded-full border border-[#facc15]/10 bg-[#facc15]/[0.02]" />
                    </div>
                    <div className="relative z-10 mx-auto max-w-[1400px]">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#16a34a]">More when you need it</p>
                            <h2 id="landing-capabilities-title" className="mt-2 text-2xl font-bold tracking-tight text-[#f4f4f5] sm:text-3xl">A football starting point that grows with you.</h2>
                            <p className="mt-3 text-sm leading-6 text-[#a1a1aa] sm:text-base">The first step is simply finding the right place. From there, every part of GrassKickZ is designed to make the next useful action easier to find.</p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {landingCapabilities.map((capability) => (
                                <article key={capability.title} data-bounce-surface={`capability-${capability.title.toLocaleLowerCase().replaceAll(' ', '-')}`} className="rounded-xl border border-[#ffffff0d] bg-[#16181d] p-5">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${capability.background}`}>
                                        <capability.icon className={`h-5 w-5 ${capability.tone}`} />
                                    </div>
                                    <h3 className="mt-5 text-base font-semibold text-[#f4f4f5]">{capability.title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">{capability.body}</p>
                                </article>
                            ))}
                        </div>

                        <div className="relative mt-8 min-h-[300px] overflow-hidden rounded-2xl border border-dashed border-[#ffffff1a] bg-[#111318]" data-playground-field>
                            <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
                                <div className="absolute inset-x-8 top-1/2 h-px bg-[#ffffff0d]" />
                                <div className="absolute left-1/2 top-8 h-[calc(100%-4rem)] w-px bg-[#ffffff0d]" />
                                <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffffff0d]" />
                            </div>
                            <div className="relative flex min-h-[300px] items-center justify-center px-6 text-center">
                                <div className="max-w-md">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717a]">A little room to explore</p>
                                    <p className="mt-2 text-sm leading-6 text-[#71717a]">Open the optional Playground when you want to experiment. The product stays quiet here until you invite the footballs in.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </LandingReveal>

            <LandingReveal delayMs={100}>
                <section className="border-t border-[#ffffff0d] bg-[#0f1117] px-6 py-10 sm:px-8" aria-labelledby="landing-next-step-title">
                    <div data-bounce-surface="next-step" className="mx-auto flex max-w-[1400px] flex-col gap-5 rounded-2xl border border-[#ffffff0d] bg-[#16181d] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Your next step</p>
                        <h2 id="landing-next-step-title" className="mt-2 text-xl font-semibold text-[#f4f4f5]">See the map first. Join when you need more.</h2>
                        <p className="mt-2 text-sm leading-6 text-[#a1a1aa]">Browsing stays open. Create an account when you want to follow clubs, message people, or start building your own football space.</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-3">
                        <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#22c55e]">
                            Create account
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link to="/clubs" className="inline-flex items-center gap-2 rounded-xl border border-[#ffffff0d] px-4 py-2.5 text-sm font-semibold text-[#f4f4f5] transition-colors hover:bg-[#1a1c22]">
                            Browse clubs
                            <MapPin className="h-4 w-4" />
                        </Link>
                    </div>
                    </div>
                </section>
            </LandingReveal>

            <LandingPlayground active={playgroundActive} onActiveChange={setPlaygroundActive} />

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
