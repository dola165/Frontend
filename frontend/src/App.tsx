import { MatchesHub, LegacyMatchesRoute } from './features/competitions/MatchesHub';
import { WorkspacesPage, WorkspaceConnectionBar } from './components/layout/ConnectedWork';
import { useTranslation } from 'react-i18next';
import { isAndroidApp, nativeCall } from './android/bridge';
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type CSSProperties, type JSX } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TopNav } from './components/layout/TopNav';
import { useMapWorkspaceChrome, setPlanningNavigation } from './context/mapWorkspaceChrome';
import { HomeOpportunities } from './components/layout/HomeOpportunities';
import './components/layout/home-rails.css';
import './components/layout/home-feed.css';
import './components/club/club-design-theme.css';
import { AppPageFrame } from './components/layout/AppPageShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthSessionBoundary } from './context/AuthSessionBoundary';
import { buildLoginRedirectPath, clearAuthFlow, completedAuthDestination, getAuthFlow, isAuthFlowRoute, requiredAccountStep, resolvePostAuthRedirect } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';
import { applyDocumentTheme, readThemePreference, themeForRoute, isThemePreference, type ThemePreference } from './theme';
import { AppSettingsPage } from './android/AppSettingsPage';
import { ExtensionRoute } from './features/capabilities/ExtensionBoundary';
import { ROLE_DETAIL_ROUTE_PATHS, ROLE_DIRECTORY_ROUTE_PATHS } from './features/roles/routes';

import { RouteViewport } from './components/layout/RouteViewport';
import { RouteMetadata } from './components/layout/RouteMetadata';
import { LoginPage } from './pages/LoginPage';

// Native navigation and chat replace these browser surfaces. Keep their imports
// behind the build flag as well as their rendering, so hidden quick chat never
// fetches conversations or starts a second connection in Android.
const LeftSidebar = isAndroidApp ? null : lazy(() => import('./components/layout/LeftSidebar').then(module => ({ default: module.LeftSidebar })));
import { AgentDolaPage, DolaDock } from './features/dola/AgentDolaPage';
import { DolaProvider } from './features/dola/DolaProvider';
const RightSidebar = isAndroidApp ? null : lazy(() => import('./components/layout/RightSidebar').then(module => ({ default: module.RightSidebar })));

const CampaignsPage = lazy(() => import('./pages/CampaignsPage').then(module => ({default: module.CampaignsPage})));
const CampaignDetailPage = lazy(() => import('./pages/CampaignDetailPage').then(module => ({default: module.CampaignDetailPage})));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage').then(module => ({default: module.JobDetailPage})));
const StorePage = lazy(() => import('./pages/StorePage').then(module => ({default: module.StorePage})));
const StadiumsPage = lazy(() => import('./pages/StadiumsPage').then(module => ({default: module.StadiumsPage})));
const MyOrganizationsPage = lazy(() => import('./pages/MyOrganizationsPage').then(module => ({default: module.MyOrganizationsPage})));
const StadiumProfilePage = lazy(() => import('./pages/StadiumProfilePage').then(module => ({default: module.StadiumProfilePage})));
const StadiumWorkspacePage = lazy(() => import('./pages/StadiumWorkspacePage').then(module => ({default: module.StadiumWorkspacePage})));
const ClubStorePage = lazy(() => import('./pages/ClubStorePage').then(module => ({default: module.ClubStorePage})));
const StoreProductPage = lazy(() => import('./pages/StoreProductPage').then(module => ({default: module.StoreProductPage})));
const StoreCartPage = lazy(() => import('./pages/StoreCartPage').then(module => ({default: module.StoreCartPage})));
const CommerceDemoPage = lazy(() => import('./pages/CommerceDemoPage').then(module => ({default: module.CommerceDemoPage})));
const ParentHubPage = lazy(() => import('./pages/ParentHubPage').then(module => ({default: module.ParentHubPage})));
const AdmissionHomePage = lazy(() => import('./features/admissions/applicant/AdmissionHomePage').then(module => ({default: module.AdmissionHomePage})));
const OpportunityBrowsePage = lazy(() => import('./features/admissions/applicant/OpportunityBrowsePage').then(module => ({default: module.OpportunityBrowsePage})));
const OpportunityDetailPage = lazy(() => import('./features/admissions/applicant/OpportunityDetailPage').then(module => ({default: module.OpportunityDetailPage})));
const AdmissionCasePage = lazy(() => import('./features/admissions/applicant/AdmissionCasePage').then(module => ({default: module.AdmissionCasePage})));
const AdmissionGroupSchedulePage = lazy(() => import('./features/admissions/applicant/AdmissionGroupSchedulePage').then(module => ({default: module.AdmissionGroupSchedulePage})));
const GeneralAdmissionInquiryPage = lazy(() => import('./features/admissions/applicant/AdmissionInquiryPage').then(module => ({default: module.GeneralAdmissionInquiryPage})));
const AdmissionInquiryPage = lazy(() => import('./features/admissions/applicant/AdmissionInquiryPage').then(module => ({default: module.AdmissionInquiryPage})));
const SquadJoinPage = lazy(() => import('./features/squadEnrollment/SquadEnrollment').then(module => ({default: module.SquadJoinPage})));
const FamilyEnrollmentPage = lazy(() => import('./features/squadEnrollment/SquadEnrollment').then(module => ({default: module.FamilyEnrollmentPage})));
const TournamentSeriesPage = lazy(() => import('./features/tournamentSeries/TournamentSeriesPage').then(module => ({default: module.TournamentSeriesPage})));
const VolunteerPage = lazy(() => import('./pages/VolunteerPage').then(module => ({default: module.VolunteerPage})));
const EventVenuePage = lazy(() => import('./pages/EventVenuePage').then(module => ({default: module.EventVenuePage})));
const MySquadsPage = lazy(() => import('./pages/SquadCommunicationPage').then(module => ({default: module.MySquadsPage})));
const SquadCommunicationPage = lazy(() => import('./pages/SquadCommunicationPage').then(module => ({default: module.SquadCommunicationPage})));
const ClubPublicProfileSettingsPage = lazy(() => import('./pages/ClubPublicProfileSettingsPage').then(module => ({default: module.ClubPublicProfileSettingsPage})));
const ClubOperationsPage = lazy(() => import('./pages/ClubOperationsPage'));
const MyClubOperationsPage = lazy(() => import('./pages/MyClubOperationsPage'));
const ClubProfilePage = lazy(() => import('./pages/ClubProfilePage').then(module => ({default: module.ClubProfilePage})));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(module => ({default: module.UserProfilePage})));
const AgentProfilePage = lazy(() => import('./pages/AgentProfilePage').then(module => ({default: module.AgentProfilePage})));
const MapPage = lazy(() => import('./pages/MapPage').then(module => ({default: module.MapPage})));
const FeedPage = lazy(() => import('./pages/FeedPage').then(module => ({default: module.FeedPage})));
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({default: module.LandingPage})));
const BrowseClubsPage = lazy(() => import('./pages/BrowseClubsPage').then(module => ({default: module.BrowseClubsPage})));
const MessagingPage = lazy(() => import('./pages/MessagingPage').then(module => ({default: module.MessagingPage})));
const MyClubPage = lazy(() => import('./pages/MyClubPage').then(module => ({default: module.MyClubPage})));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(module => ({default: module.CalendarPage})));
const ClubSquadsPage = lazy(() => import('./pages/ClubSquadsPage').then(module => ({default: module.ClubSquadsPage})));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(module => ({default: module.NotificationsPage})));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(module => ({default: module.OnboardingPage})));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({default: module.RegisterPage})));
const DobGatePage = lazy(() => import('./pages/DobGatePage').then(module => ({default: module.DobGatePage})));
const ConsentPage = lazy(() => import('./pages/ConsentPage').then(module => ({default: module.ConsentPage})));
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage').then(module => ({default: module.SetPasswordPage})));
const OAuth2RedirectHandler = lazy(() => import('./pages/OAuth2RedirectHandler').then(module => ({default: module.OAuth2RedirectHandler})));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(module => ({default: module.ForgotPasswordPage})));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(module => ({default: module.ResetPasswordPage})));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(module => ({default: module.VerifyEmailPage})));
const ReportReceipts = lazy(() => import('./features/moderation/ReportReceipts').then(module => ({default: module.ReportReceipts})));
const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({default: module.AccountPage})));
const RequestsCentre = lazy(() => import('./features/requests/RequestsCentre').then(module => ({default: module.RequestsCentre})));
const EventDiscoveryPage = lazy(() => import('./features/requests/EventDiscoveryPage').then(module => ({default: module.EventDiscoveryPage})));
const TryoutBrowsePage = lazy(() => import('./features/tryouts/TryoutBrowsePage'));
const TryoutDetailPage = lazy(() => import('./features/tryouts/TryoutDetailPage'));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({default: module.AdminPage})));
const TournamentSetupPage = lazy(() => import('./pages/TournamentSetupPage').then(module => ({default: module.TournamentSetupPage})));
const TournamentWorkspacePage = lazy(() => import('./pages/TournamentWorkspacePage').then(module => ({default: module.TournamentWorkspacePage})));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage').then(module => ({default: module.TournamentDetailPage})));
const CreateOrganizationPage = lazy(() => import('./pages/CreateOrganizationPage').then(module => ({default: module.CreateOrganizationPage})));
const OrganizationProfilePage = lazy(() => import('./pages/OrganizationProfilePage').then(module => ({default: module.OrganizationProfilePage})));
const FootballRolesPage = lazy(() => import('./pages/FootballRolesPage').then(module => ({default: module.FootballRolesPage})));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage').then(module => ({default: module.MatchDetailPage})));
const RefereePage = lazy(() => import('./pages/RefereePage').then(module => ({default: module.RefereePage})));
const AgentDashboardPage = lazy(() => import('./pages/AgentDashboardPage').then(module => ({default: module.AgentDashboardPage})));
const OrganizationWorkspacePage = lazy(() => import('./pages/OrganizationWorkspacePage').then(module => ({default: module.OrganizationWorkspacePage})));
const ClubWorkspacePage = lazy(() => import('./pages/ClubWorkspacePage').then(module => ({default: module.default})));
const FollowedClubsPage = lazy(() => import('./pages/FollowedClubsPage').then(module => ({default: module.FollowedClubsPage})));
const JobsDirectoryPage = lazy(() => import('./pages/JobsDirectoryPage').then(module => ({default: module.JobsDirectoryPage})));
const PeoplePage = lazy(() => import('./pages/PeoplePage').then(module => ({default: module.PeoplePage})));
const PostPage = lazy(() => import('./pages/PostPage').then(module => ({default: module.PostPage})));
const PublicWorldMapPage = lazy(() => import('./pages/PublicWorldMapPage').then(module => ({default: module.PublicWorldMapPage})));
const RouteRecoveryPage = lazy(() => import('./pages/RouteRecoveryPage').then(module => ({default: module.RouteRecoveryPage})));

const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/consent']);
const boundedCanvasPages = new Set(['/map', '/messages', '/calendar']);

const PageBootSpinner = ({ label }: { label: string }) => (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)]">
        <div role="status" className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"></div>
            <p className="text-sm font-medium text-[var(--color-secondary)]">
                {label}
            </p>
        </div>
    </div>
);

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Restoring Session" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    return children;
};

const GuestOnlyRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();
    const nextPath = resolvePostAuthRedirect(new URLSearchParams(location.search).get('next'), completedAuthDestination(user ?? {}, null, getAuthFlow().newAccount));

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Access" />;
    }

    if (isAuthenticated) {
        return <Navigate to={requiredAccountStep(user) ?? nextPath} replace />;
    }

    return children;
};

const SystemAdminRoute = ({ children }: { children: JSX.Element }) => {
    const location = useLocation();
    const { isBootstrapping, isAuthenticated, user } = useAuth();

    if (isBootstrapping) {
        return <PageBootSpinner label="Checking Admin Access" />;
    }

    if (!isAuthenticated) {
        return <Navigate to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} replace />;
    }

    if (user?.role !== 'SYSTEM_ADMIN') {
        return <Navigate to="/feed" replace />;
    }

    return children;
};

export function MainLayout() {
    // Re-render presentation on language changes without remounting page state.
    useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (isAndroidApp) void nativeCall({ kind: 'destination', path: location.pathname });
        if (isAndroidApp && location.pathname === '/messages') {
            void nativeCall({ kind: 'navigate', path: location.pathname + location.search });
        }
    }, [location.pathname, location.search]);
    const { status, user, logout, refreshNavigationCapabilities } = useAuth();
    useEffect(() => {
        if (status === 'authenticated') void refreshNavigationCapabilities?.();
    }, [location.key, status, refreshNavigationCapabilities]);
    useEffect(() => {
        // Installing a session remounts this layout. Keep its continuation available
        // until the router arrives, so GuestOnlyRoute and the login callback agree.
        // location.key also covers a late login callback replacing the same destination.
        if (status === 'authenticated' && !requiredAccountStep(user) && !isAuthFlowRoute(location.pathname)) clearAuthFlow();
    }, [status, user, location.pathname, location.key]);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const managedClubs = (user?.navigationCapabilities?.workspaces ?? [])
        .filter(workspace => workspace.id === 'club.workspace')
        .map(workspace => ({ clubId: workspace.context.id, clubName: workspace.context.label }));
    const [collapsedNavLocationKey, setCollapsedNavLocationKey] = useState<string | null>(null);
    const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);

    useEffect(() => {
        if (!isAndroidApp) return;
        const onAppearance = (event: Event) => {
            const value: unknown = (event as CustomEvent).detail;
            if (typeof value === 'string' && isThemePreference(value)) setThemePreference(value);
        };
        window.addEventListener('grasskickz:appearance', onAppearance);
        return () => window.removeEventListener('grasskickz:appearance', onAppearance);
    }, []);

    useEffect(() => {
        if (status !== 'authenticated' || !user?.id) {
            return;
        }

        if (authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback') {
            return;
        }

        if (user.mustChangePassword && location.pathname !== '/set-password') {
            navigate('/set-password', { replace: true });
            return;
        }

        if (!user.mustChangePassword && user.onboardingRequired && location.pathname !== '/onboarding') {
            navigate('/onboarding', { replace: true });
        }
    }, [location.pathname, navigate, status, user]);

    const darkMode = themePreference !== 'light';
    const effectiveTheme = themeForRoute(themePreference, location.pathname);

    useLayoutEffect(() => {
        applyDocumentTheme(effectiveTheme);
        localStorage.setItem('theme-preference', themePreference);
        // Retain the legacy value for older clients that only understand the
        // original light/dark key.
        localStorage.setItem('theme', themePreference === 'light' ? 'light' : 'dark');
    }, [effectiveTheme, themePreference]);

    useEffect(() => {
        let active = true;

        // These links belong to the browser navigation, which Android replaces
        // with its native Shortcuts. Avoid a redundant request on every route.
        if (isAndroidApp || status !== 'authenticated') {
            return () => {
                active = false;
            };
        }

        void fetchMyClubMembershipContext()
            .then((context) => {
                if (!active) {
                    return;
                }
                setMyClubId(context?.clubId ? Number(context.clubId) : null);
            })
            .catch(() => {
                if (active) {
                    setMyClubId(null);
                }
            });

        return () => {
            active = false;
        };
    }, [location.pathname, status]);

    const handleLogout = async () => {
        setMyClubId(null);
        await logout();
        navigate('/login', { replace: true });
    };

    const isLandingPage = location.pathname === '/';
    const isPublicWorldMap = location.pathname === '/world';
    const isAuthPage = authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback';
    const isHomeFeed = location.pathname === '/home' || location.pathname === '/feed';
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads|\/workspace|\/operations|\/profile-settings|\/store|\/campaigns)?$/.test(location.pathname);
    // Public destination pages with full-bleed heroes (banner + tab bars) render
    // edge-to-edge; everything else keeps the bounded wide frame.
    const isBleedDestinationPage =
        location.pathname === '/clubs' ||
        /^\/clubs\/\d+$/.test(location.pathname) ||
        /^\/organizations\/\d+$/.test(location.pathname) ||
        /^\/profile\/\d+$/.test(location.pathname);
    const isFullScreenPage =
        location.pathname === '/workspaces' || location.pathname === '/reports' ||
        location.pathname === '/requests' || location.pathname === '/events' ||
        location.pathname === '/tryouts' || location.pathname.startsWith('/tryouts/') ||
        location.pathname === '/admissions' || location.pathname.startsWith('/admissions/') ||
        location.pathname === '/club-operations' ||
        location.pathname === '/assistant' ||
        location.pathname === '/account/roles' ||
        (isAndroidApp && location.pathname === '/app-settings') ||
        ['/map', '/world', '/messages', '/clubs', '/clubs/following', '/clubs/create', '/my-club', '/my-organizations', '/calendar', '/notifications', '/onboarding', '/dob', '/set-password', '/account', '/admin', '/tournaments', '/tournaments/setup', '/marketplace', '/needs', '/store', '/jobs', '/roles', '/campaigns', '/people'].includes(location.pathname) ||
        location.pathname === '/parent' || location.pathname === '/parent/enrollment' ||
        location.pathname === '/join-squad' || location.pathname === '/volunteering' || location.pathname === '/event-venues' ||
        location.pathname.startsWith('/tournament-series/') ||
        location.pathname === '/matches' || location.pathname.startsWith('/match-exchange') || location.pathname === '/match-history' || location.pathname.startsWith('/referees/') ||
        location.pathname === '/squads' || location.pathname.startsWith('/squads/') ||
        location.pathname === '/demo/commerce' ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/posts/') ||
        location.pathname.startsWith('/store/') ||
        location.pathname === '/stadiums' || location.pathname.startsWith('/stadiums/') ||
        location.pathname.startsWith('/jobs/') || location.pathname.startsWith('/roles/') ||
        location.pathname.startsWith('/campaigns/') ||
        location.pathname.startsWith('/organizations') ||
        location.pathname.startsWith('/tournaments/') ||
        location.pathname.startsWith('/agent') ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname);
    // W6 â€” one shell: browse/list/destination pages share a single App-level
    // frame (app-page-shell + AppPageFrame, one max-width); the map, chat,
    // schedule and the management workspaces stay full-width canvases.
    const canvasWorkspacePages = new Set(['/map', '/world', '/calendar', '/messages', '/onboarding', '/dob', '/set-password']);
    const isImmersiveCanvasPage =
        /^\/clubs\/\d+\/operations$/.test(location.pathname) ||
        canvasWorkspacePages.has(location.pathname) ||
        /^\/clubs\/\d+\/workspace$/.test(location.pathname) ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname);
    const isCollapsibleNavWorkspace =
        /^\/clubs\/\d+\/operations$/.test(location.pathname) ||
        ['/map', '/calendar', '/messages'].includes(location.pathname) ||
        /^\/clubs\/\d+\/workspace$/.test(location.pathname) ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname);
    // React Router assigns a new key to every navigation entry. Binding the
    // collapsed state to that key makes it route-visit-local without an effect:
    // navigate away (or revisit later) and navigation is immediately visible.
    const mapChrome = useMapWorkspaceChrome();
    const isMapPlanning = location.pathname === '/map' && mapChrome.planning;
    const isTopNavCollapsed = isCollapsibleNavWorkspace && (isMapPlanning ? !mapChrome.navigationExpanded : collapsedNavLocationKey === location.key);
    const hasProductNavigation = !isAndroidApp && !isLandingPage && !isAuthPage && !isPublicWorldMap;
    const activeHeaderHeight = hasProductNavigation && !isTopNavCollapsed
        ? 'var(--app-header-height)'
        : '0px';

    const fullScreenRoutes = (
        <RouteViewport><WorkspaceConnectionBar /><Routes>
            <Route path="/workspaces" element={<ProtectedRoute><WorkspacesPage /></ProtectedRoute>} />
            <Route path="/assistant" element={<ProtectedRoute><AgentDolaPage /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><MapPage darkMode={themePreference === 'dark'} /></ProtectedRoute>} />
            <Route path="/world" element={<PublicWorldMapPage />} />
            <Route path="/clubs" element={<BrowseClubsPage />} />
            <Route path="/clubs/following" element={<ProtectedRoute><FollowedClubsPage /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage user={user} darkMode={darkMode} setDarkMode={(value) => setThemePreference(value ? 'dark' : 'light')} /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute>{isAndroidApp ? <PageBootSpinner label="Opening messages" /> : <MessagingPage />}</ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><RequestsCentre /></ProtectedRoute>} />
            <Route path="/events" element={<EventDiscoveryPage />} />
            <Route path="/tryouts" element={<TryoutBrowsePage />} />
            <Route path="/tryouts/:tryoutId" element={<TryoutDetailPage />} />
            <Route path="/admissions/opportunities" element={<OpportunityBrowsePage />} />
            <Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
            <Route path="/admissions/cases/:caseId" element={<ProtectedRoute><AdmissionCasePage /></ProtectedRoute>} />
            <Route path="/admissions" element={<ProtectedRoute><AdmissionHomePage /></ProtectedRoute>} />
            <Route path="/admissions/groups/:groupId/schedule" element={<ProtectedRoute><AdmissionGroupSchedulePage /></ProtectedRoute>} />
            <Route path="/admissions/organizations/:organizationId/inquire" element={<ProtectedRoute><GeneralAdmissionInquiryPage /></ProtectedRoute>} />
            <Route path="/admissions/inquiries/:inquiryId" element={<ProtectedRoute><AdmissionInquiryPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportReceipts /></ProtectedRoute>} />
            <Route path="/account/roles" element={<ProtectedRoute><FootballRolesPage /></ProtectedRoute>} />
            <Route path="/matches" element={<MatchesHub />} />
            <Route path="/match-exchange" element={<ProtectedRoute><LegacyMatchesRoute kind="matches" /></ProtectedRoute>} />
            <Route path="/match-history" element={<ProtectedRoute><LegacyMatchesRoute kind="history" /></ProtectedRoute>} />
            <Route path="/match-exchange/:eventId" element={<ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
            <Route path="/referees/:refereeId" element={<ProtectedRoute><RefereePage /></ProtectedRoute>} />
            <Route path="/parent" element={<ProtectedRoute><ParentHubPage /></ProtectedRoute>} />
            <Route path="/join-squad" element={<ExtensionRoute capability="squadEnrollment"><ProtectedRoute><SquadJoinPage /></ProtectedRoute></ExtensionRoute>} />
            <Route path="/parent/enrollment" element={<ExtensionRoute capability="squadEnrollment"><ProtectedRoute><FamilyEnrollmentPage /></ProtectedRoute></ExtensionRoute>} />
            <Route path="/tournament-series/:seriesId" element={<ExtensionRoute capability="tournamentSeries"><TournamentSeriesPage /></ExtensionRoute>} />
            <Route path="/volunteering" element={<ExtensionRoute capability="volunteerShifts"><ProtectedRoute><VolunteerPage /></ProtectedRoute></ExtensionRoute>} />
            <Route path="/event-venues" element={<ExtensionRoute capability="eventVenueAttachment"><ProtectedRoute><EventVenuePage /></ProtectedRoute></ExtensionRoute>} />
            <Route path="/squads" element={<ProtectedRoute><MySquadsPage /></ProtectedRoute>} />
            <Route path="/squads/:squadId" element={<ProtectedRoute><SquadCommunicationPage /></ProtectedRoute>} />
            <Route path="/demo/commerce" element={<ProtectedRoute><CommerceDemoPage /></ProtectedRoute>} />
            {isAndroidApp && <Route path="/app-settings" element={<AppSettingsPage theme={themePreference} />} />}
            <Route path="/tournaments" element={<LegacyMatchesRoute kind="competitions" />} />
            <Route path="/tournaments/setup" element={<ProtectedRoute><TournamentSetupPage /></ProtectedRoute>} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:tournamentId/workspace" element={<ProtectedRoute><TournamentWorkspacePage /></ProtectedRoute>} />
            <Route path="/organizations/create" element={<ProtectedRoute><CreateOrganizationPage /></ProtectedRoute>} />
            <Route path="/organizations/:organizationId/workspace" element={<ProtectedRoute><OrganizationWorkspacePage /></ProtectedRoute>} />
            <Route path="/organizations/:organizationId" element={<ProtectedRoute><OrganizationProfilePage /></ProtectedRoute>} />
            <Route path="/admin" element={<SystemAdminRoute><AdminPage /></SystemAdminRoute>} />
            <Route path="/profile/:id" element={<UserProfilePage />} />
            <Route path="/agents/:id" element={<AgentProfilePage />} />
            <Route path="/posts/:postId" element={<PostPage />} />
            <Route path="/agent" element={<ProtectedRoute><AgentDashboardPage /></ProtectedRoute>} />
            <Route path="/agent/dashboard" element={<ProtectedRoute><AgentDashboardPage /></ProtectedRoute>} />
            <Route path="/agent/*" element={<RouteRecoveryPage feature="Agent tools" />} />
            <Route path="/marketplace" element={<RouteRecoveryPage feature="The marketplace" />} />
            <Route path="/needs" element={<RouteRecoveryPage feature="Player needs" />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/stadiums" element={<StadiumsPage />} />
            <Route path="/stadiums/:organizationId" element={<StadiumProfilePage />} />
            <Route path="/stadiums/:organizationId/manage" element={<ProtectedRoute><StadiumWorkspacePage /></ProtectedRoute>} />
            <Route path="/store/products/:id" element={<StoreProductPage />} />
            <Route path="/store/cart" element={<StoreCartPage />} />
            {ROLE_DIRECTORY_ROUTE_PATHS.map(path => <Route key={path} path={path} element={<JobsDirectoryPage />} />)}
            {ROLE_DETAIL_ROUTE_PATHS.map(path => <Route key={path} path={path} element={<JobDetailPage />} />)}
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/clubs/:id/campaigns" element={<CampaignsPage />} />
            <Route path="/people" element={<ProtectedRoute><PeoplePage /></ProtectedRoute>} />
            <Route path="/clubs/:id/store" element={<ClubStorePage />} />
            <Route path="/clubs/:id/squads" element={<ProtectedRoute><ClubSquadsPage /></ProtectedRoute>} />
            <Route path="/clubs/:id/profile-settings" element={<ProtectedRoute><ClubPublicProfileSettingsPage /></ProtectedRoute>} />
            <Route path="/clubs/:id/operations" element={<ProtectedRoute><ClubOperationsPage /></ProtectedRoute>} />
            <Route path="/club-operations" element={<ProtectedRoute><MyClubOperationsPage /></ProtectedRoute>} />
            <Route path="/clubs/:id/workspace" element={<ProtectedRoute><ClubWorkspacePage darkMode={darkMode} /></ProtectedRoute>} />
            <Route path="/clubs/:id" element={<ClubProfilePage />} />
            <Route path="/clubs/create" element={<ProtectedRoute><Navigate to="/organizations/create?kind=CLUB" replace /></ProtectedRoute>} />
            <Route path="/my-organizations" element={<ProtectedRoute><MyOrganizationsPage /></ProtectedRoute>} />
            <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="/dob" element={<ProtectedRoute><DobGatePage /></ProtectedRoute>} />
            <Route path="/set-password" element={<ProtectedRoute><SetPasswordPage /></ProtectedRoute>} />
            <Route path="*" element={<RouteRecoveryPage />} />
        </Routes></RouteViewport>
    );

    return (
        <div
            className={`${hasProductNavigation ? 'product-app-shell' : ''} min-h-screen bg-[color:var(--theme-page)] text-[color:var(--text-primary)] transition-colors duration-200`}
            style={{ '--app-active-header-height': activeHeaderHeight } as CSSProperties}
        >
            <RouteMetadata />
            {hasProductNavigation && (
                <TopNav
                    user={user}
                    myClubId={myClubId}
                    managedClubs={managedClubs}
                    themePreference={themePreference}
                    setThemePreference={setThemePreference}
                    handleLogout={handleLogout}
                    collapsible={isCollapsibleNavWorkspace}
                    collapsed={isTopNavCollapsed}
                    quietCollapsed={isMapPlanning}
                    onCollapsedChange={(collapsed) => isMapPlanning ? setPlanningNavigation(!collapsed) : setCollapsedNavLocationKey(collapsed ? location.key : null)}
                />
            )}

            {isLandingPage || isAuthPage ? (
                <main>
                    <RouteViewport><Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
                        <Route path="/signup" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/consent" element={<ConsentPage />} />
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes></RouteViewport>
                </main>
            ) : isFullScreenPage ? (
                isImmersiveCanvasPage ? (
                    <main
                        className={`relative w-full ${isBoundedCanvasPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
                        style={isTopNavCollapsed || isPublicWorldMap
                            ? { minHeight: '100dvh', height: '100dvh' }
                            : { minHeight: 'calc(100dvh - var(--app-header-height))', height: 'calc(100dvh - var(--app-header-height))' }}
                    >
                        {fullScreenRoutes}
                    </main>
                ) : (
                    <main className="app-page-shell min-h-[calc(100dvh-var(--app-header-height))]">
                        <AppPageFrame variant={isBleedDestinationPage ? 'bleed' : 'wide'} className={`app-route-frame ${isBleedDestinationPage ? '' : 'py-6'}`}>
                            {fullScreenRoutes}
                        </AppPageFrame>
                    </main>
                )
            ) : (
                <div className={isHomeFeed ? 'feed-home-shell min-h-[calc(100dvh-var(--app-header-height))]' : ''}>
                    {isHomeFeed && <HomeOpportunities className="home-opportunities--feed" />}
                    <div className={isHomeFeed ? 'feed-home-grid home-feed-layout' : 'grid grid-cols-1 gap-6 pb-10 pt-6 mx-auto max-w-[1480px] px-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[220px_minmax(0,720px)_280px]'}>
                            {LeftSidebar && <Suspense fallback={null}><LeftSidebar user={user} managedClubs={managedClubs} /></Suspense>}

                        <main className="min-w-0">
                            <RouteViewport><Routes>
                                <Route path="/home" element={<ProtectedRoute><FeedPage user={user} managedClubs={managedClubs} /></ProtectedRoute>} />
                                <Route path="/feed" element={<Navigate to={`/home${location.search}`} replace />} />
                                <Route path="*" element={<RouteRecoveryPage />} />
                            </Routes></RouteViewport>
                        </main>

                        {RightSidebar && <Suspense fallback={null}><RightSidebar /></Suspense>}
                    </div>
                </div>
            )}

        </div>
    );
}

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <AuthSessionBoundary><DolaProvider><MainLayout /><DolaDock /></DolaProvider></AuthSessionBoundary>
            </AuthProvider>
        </Router>
    );
}
