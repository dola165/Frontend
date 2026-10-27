import { CreatePageHost } from './features/pages/create/CreatePageHost';
import { ActionHost } from './features/actions/ActionHost';
import { CornerDock } from './components/layout/CornerDock';
import { useTranslation } from 'react-i18next';
import { isAndroidApp, nativeCall } from './android/bridge';
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type CSSProperties, type JSX } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from './components/layout/header/AppHeader';
import { HomeOpportunities } from './components/layout/HomeOpportunities';
import './components/layout/home-rails.css';
import './components/layout/home-feed.css';
import './components/club/club-design-theme.css';
import { AppPageFrame } from './components/layout/AppPageShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isSystemAdmin } from './context/navigationCapabilities';
import { AuthSessionBoundary } from './context/AuthSessionBoundary';
import { beginExplicitSignOut, buildLoginRedirectPath, clearAuthFlow, completedAuthDestination, completeSignOutNavigation, getAuthFlow, isAuthFlowRoute, requiredAccountStep, resolvePostAuthRedirect, WAITING_FOR_PARENT_PATH } from './utils/authRedirect';
import { fetchMyClubMembershipContext } from './features/clubs/api';
import { applyDocumentTheme, chooseThemePreference, readThemePreference, themeForRoute, isThemePreference, type ThemePreference } from './theme';
import { AppSettingsPage } from './android/AppSettingsPage';
import { ROLE_DETAIL_ROUTE_PATHS, ROLE_DIRECTORY_ROUTE_PATHS } from './features/roles/routes';
import { LegacyMatchesRedirect, WorldRedirect } from './features/world/WorldRedirect';
import { keepRegistrationTown } from './features/start/startApi';
import { WELCOME_PARAM } from './features/start/welcomeSteps';
import { useMediaQuery } from './features/world/useMediaQuery';

import { LegacyCleanupRedirect } from './features/requests/LegacyCleanupRedirects';
import { RouteViewport } from './components/layout/RouteViewport';
import { RouteMetadata } from './components/layout/RouteMetadata';
import { useBuildWatch } from './hooks/useBuildWatch';
import { ParentApprovalBanner } from './components/auth/ParentApprovalBanner';
import { LoginPage } from './pages/LoginPage';

// Native navigation and chat replace these browser surfaces. Keep their imports
// behind the build flag as well as their rendering, so hidden quick chat never
// fetches conversations or starts a second connection in Android.
const LeftSidebar = isAndroidApp ? null : lazy(() => import('./components/layout/LeftSidebar').then(module => ({ default: module.LeftSidebar })));
import { DolaProvider } from './features/dola/DolaProvider';
const RightSidebar = isAndroidApp ? null : lazy(() => import('./components/layout/RightSidebar').then(module => ({ default: module.RightSidebar })));
// Agent Dola's conversation shows only on /assistant or once its panel is opened, so its code and styles load after the first screen.
const AgentDolaPage = lazy(() => import('./features/dola/AgentDolaPage').then(module => ({ default: module.AgentDolaPage })));
const DolaDock = lazy(() => import('./features/dola/AgentDolaPage').then(module => ({ default: module.DolaDock })));
const FirstWeek = lazy(() => import('./features/firstWeek/FirstWeek').then(module => ({ default: module.FirstWeek })));

const FundraisingPage = lazy(() => import('./pages/FundraisingPage').then(module => ({default: module.FundraisingPage})));
const FundraisingCataloguePage = lazy(() => import('./pages/FundraisingCataloguePage').then(module => ({default: module.FundraisingCataloguePage})));
const ClubFundraisingPage = lazy(() => import('./pages/ClubFundraisingPage').then(module => ({default: module.ClubFundraisingPage})));
const FundraiserPage = lazy(() => import('./pages/FundraiserPage').then(module => ({default: module.FundraiserPage})));
const FundraiserManagePage = lazy(() => import('./pages/FundraiserManagePage').then(module => ({default: module.FundraiserManagePage})));
const StartFundraiserPage = lazy(() => import('./pages/StartFundraiserPage').then(module => ({default: module.StartFundraiserPage})));
const JobDetailPage = lazy(() => import('./pages/JobDetailPage').then(module => ({default: module.JobDetailPage})));
const JobsPage = lazy(() => import('./pages/JobsPage').then(module => ({default: module.JobsPage})));
const JobsCataloguePage = lazy(() => import('./pages/JobsCataloguePage').then(module => ({default: module.JobsCataloguePage})));
const ClubJobsPage = lazy(() => import('./pages/ClubJobsPage').then(module => ({default: module.ClubJobsPage})));
const PostJobPage = lazy(() => import('./pages/PostJobPage').then(module => ({default: module.PostJobPage})));
const StorePage = lazy(() => import('./pages/StorePage').then(module => ({default: module.StorePage})));
const MyOrganizationsPage = lazy(() => import('./pages/MyOrganizationsPage').then(module => ({default: module.MyOrganizationsPage})));
const StadiumProfilePage = lazy(() => import('./pages/StadiumProfilePage').then(module => ({default: module.StadiumProfilePage})));
const StadiumWorkspacePage = lazy(() => import('./pages/StadiumWorkspacePage').then(module => ({default: module.StadiumWorkspacePage})));
const ClubStorePage = lazy(() => import('./pages/ClubStorePage').then(module => ({default: module.ClubStorePage})));
const StoreProductPage = lazy(() => import('./pages/StoreProductPage').then(module => ({default: module.StoreProductPage})));
const StoreCartPage = lazy(() => import('./pages/StoreCartPage').then(module => ({default: module.StoreCartPage})));
const StoreCataloguePage = lazy(() => import('./pages/StoreCataloguePage').then(module => ({default: module.StoreCataloguePage})));
const ParentHubPage = lazy(() => import('./pages/ParentHubPage').then(module => ({default: module.ParentHubPage})));
const AdmissionHomePage = lazy(() => import('./features/admissions/applicant/AdmissionHomePage').then(module => ({default: module.AdmissionHomePage})));
const OpportunityDetailPage = lazy(() => import('./features/admissions/applicant/OpportunityDetailPage').then(module => ({default: module.OpportunityDetailPage})));
const AdmissionCasePage = lazy(() => import('./features/admissions/applicant/AdmissionCasePage').then(module => ({default: module.AdmissionCasePage})));
const AdmissionGroupSchedulePage = lazy(() => import('./features/admissions/applicant/AdmissionGroupSchedulePage').then(module => ({default: module.AdmissionGroupSchedulePage})));
const GeneralAdmissionInquiryPage = lazy(() => import('./features/admissions/applicant/AdmissionInquiryPage').then(module => ({default: module.GeneralAdmissionInquiryPage})));
const AdmissionInquiryPage = lazy(() => import('./features/admissions/applicant/AdmissionInquiryPage').then(module => ({default: module.AdmissionInquiryPage})));
const MySquadsPage = lazy(() => import('./pages/SquadCommunicationPage').then(module => ({default: module.MySquadsPage})));
const SquadCommunicationPage = lazy(() => import('./pages/SquadCommunicationPage').then(module => ({default: module.SquadCommunicationPage})));
const ClubPublicProfileSettingsPage = lazy(() => import('./pages/ClubPublicProfileSettingsPage').then(module => ({default: module.ClubPublicProfileSettingsPage})));
const ClubOperationsPage = lazy(() => import('./pages/ClubOperationsPage'));
const ClubProfilePage = lazy(() => import('./features/clubs/profile/ClubProfilePage').then(module => ({default: module.ClubProfilePage})));
const PersonProfilePage = lazy(() => import('./features/profiles/person/PersonProfilePage').then(module => ({default: module.PersonProfilePage})));
const MyProfileRedirect = lazy(() => import('./features/profiles/person/PersonProfilePage').then(module => ({default: module.MyProfileRedirect})));
const FeedPage = lazy(() => import('./pages/FeedPage').then(module => ({default: module.FeedPage})));
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({default: module.LandingPage})));
const MessagingPage = lazy(() => import('./pages/MessagingPage').then(module => ({default: module.MessagingPage})));
const MyClubPage = lazy(() => import('./pages/MyClubPage').then(module => ({default: module.MyClubPage})));
const CalendarRedirect = lazy(() => import('./features/schedule/personal/CalendarRedirect').then(module => ({default: module.CalendarRedirect})));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(module => ({default: module.OnboardingPage})));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({default: module.RegisterPage})));
const ConsentPage = lazy(() => import('./pages/ConsentPage').then(module => ({default: module.ConsentPage})));
const SetPasswordPage = lazy(() => import('./pages/SetPasswordPage').then(module => ({default: module.SetPasswordPage})));
const OAuth2RedirectHandler = lazy(() => import('./pages/OAuth2RedirectHandler').then(module => ({default: module.OAuth2RedirectHandler})));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(module => ({default: module.ForgotPasswordPage})));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(module => ({default: module.ResetPasswordPage})));
const ClubInvitePage = lazy(() => import('./pages/ClubInvitePage').then(module => ({default: module.ClubInvitePage})));
const StaffLinkPage = lazy(() => import('./pages/StaffLinkPage').then(module => ({default: module.StaffLinkPage})));
const StaffClubPage = lazy(() => import('./pages/StaffClubPage').then(module => ({default: module.StaffClubPage})));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(module => ({default: module.VerifyEmailPage})));
const WaitingForParentPage = lazy(() => import('./pages/WaitingForParentPage').then(module => ({default: module.WaitingForParentPage})));
const OwnAccountPage = lazy(() => import('./pages/OwnAccountPage').then(module => ({default: module.OwnAccountPage})));
const ParentApprovalPage = lazy(() => import('./pages/ParentApprovalPage').then(module => ({default: module.ParentApprovalPage})));
const ReportReceipts = lazy(() => import('./features/moderation/ReportReceipts').then(module => ({default: module.ReportReceipts})));
const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({default: module.AccountPage})));
const RequestsCentre = lazy(() => import('./features/requests/RequestsCentre').then(module => ({default: module.RequestsCentre})));
const WorldRoutes = lazy(() => import('./features/world/WorldRoutes'));
const TryoutDetailPage = lazy(() => import('./features/tryouts/TryoutDetailPage'));
const TeamWorkPage = lazy(() => import('./features/teamWork/TeamWorkPage').then(module => ({default: module.TeamWorkPage})));
const TeamChatPage = lazy(() => import('./features/teamChat/TeamChatPage').then(module => ({default: module.TeamChatPage})));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({default: module.AdminPage})));
const PageReviewQueue = lazy(() => import('./features/pages/verify/PageReviewQueue').then(module => ({ default: module.PageReviewQueue })));
const PageReviewReceipt = lazy(() => import('./features/pages/verify/PageReviewReceipt').then(module => ({ default: module.PageReviewReceipt })));
const TournamentWorkspacePage = lazy(() => import('./pages/TournamentWorkspacePage').then(module => ({default: module.TournamentWorkspacePage})));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage').then(module => ({default: module.TournamentDetailPage})));
const JoinPage = lazy(() => import('./features/pages/links/JoinPage').then(module => ({ default: module.JoinPage })));
const InvitePage = lazy(() => import('./features/pages/links/InvitePage').then(module => ({ default: module.InvitePage })));
const CreateRedirect = lazy(() => import('./features/pages/create/CreateRedirect').then(module => ({ default: module.CreateRedirect })));
const OrganizationProfilePage = lazy(() => import('./pages/OrganizationProfilePage').then(module => ({default: module.OrganizationProfilePage})));
const FootballProfilePage = lazy(() => import('./features/profiles/football/FootballProfilePage').then(module => ({default: module.FootballProfilePage})));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage').then(module => ({default: module.MatchDetailPage})));
const RefereePage = lazy(() => import('./pages/RefereePage').then(module => ({default: module.RefereePage})));
const AgentDashboardPage = lazy(() => import('./pages/AgentDashboardPage').then(module => ({default: module.AgentDashboardPage})));
const OrganizationWorkspacePage = lazy(() => import('./pages/OrganizationWorkspacePage').then(module => ({default: module.OrganizationWorkspacePage})));
const ClubWorkspacePage = lazy(() => import('./pages/ClubWorkspacePage').then(module => ({default: module.default})));
const CoachWorkspacePage = lazy(() => import('./pages/CoachWorkspacePage'));
const PostPage = lazy(() => import('./pages/PostPage').then(module => ({default: module.PostPage})));
const RouteRecoveryPage = lazy(() => import('./pages/RouteRecoveryPage').then(module => ({default: module.RouteRecoveryPage})));

/**
 * Below 1000px no rule shows the Home side rails (Tailwind hides them below lg/xl; the Dola panel layouts show them
 * from 1000px), so phones skip their code and the right rail's conversation list and chat connection. Once the
 * window has been wide enough they stay mounted, as before, so narrowing it keeps an open quick chat.
 */
function useRailsFit() {
    const fits = useMediaQuery('(min-width: 1000px)', true);
    const [fitted, setFitted] = useState(fits);
    if (fits && !fitted) setFitted(true);
    return fitted;
}

// Sign-in renders without the app header; `/start` (where sign-up sends a new account) only leads to the welcome on Home.
const authRoutePaths = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/club-invite', '/verify-email', '/consent', '/start', WAITING_FOR_PARENT_PATH, '/parent-approval', '/own-account']);
const boundedCanvasPages = new Set(['/messages', '/team-work/chat']);

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

    if (!isSystemAdmin(user)) {
        return <Navigate to="/home" replace />;
    }

    return children;
};

export function MainLayout() {
    // Re-render presentation on language changes without remounting page state.
    useTranslation();
    const location = useLocation();
    useEffect(() => { if (location.pathname === '/login') completeSignOutNavigation(); }, [location.pathname]);
    const navigate = useNavigate();
    useEffect(() => {
        if (isAndroidApp) void nativeCall({ kind: 'destination', path: location.pathname });
        if (isAndroidApp && location.pathname === '/messages') {
            void nativeCall({ kind: 'navigate', path: location.pathname + location.search });
        }
    }, [location.pathname, location.search]);
    const { status, user, logout, refreshNavigationCapabilities } = useAuth();
    // A tab left open across a release moves to the new build instead of competing with it for the session.
    useBuildWatch(status === 'anonymous');
    useEffect(() => {
        if (status === 'authenticated') void refreshNavigationCapabilities?.();
    }, [location.key, status, refreshNavigationCapabilities]);
    useEffect(() => {
        // Installing a session remounts this layout. Keep its continuation available
        // until the router arrives, so GuestOnlyRoute and the login callback agree.
        // location.key also covers a late login callback replacing the same destination.
        if (status === 'authenticated' && !requiredAccountStep(user) && !isAuthFlowRoute(location.pathname)) {
            // A new account's sign-up town outlives the flow even when the first run did not save it.
            const { newAccount, town } = getAuthFlow();
            if (newAccount && town && user) void keepRegistrationTown(user.id, town).catch(() => undefined);
            clearAuthFlow();
        }
    }, [status, user, location.pathname, location.key]);
    const [myClubId, setMyClubId] = useState<number | null>(null);
    const managedClubs = (user?.navigationCapabilities?.workspaces ?? [])
        .filter(workspace => workspace.id === 'club.workspace')
        .map(workspace => ({ clubId: workspace.context.id, clubName: workspace.context.label }));
    const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
    const railsFit = useRailsFit();

    useEffect(() => {
        if (!isAndroidApp) return;
        const onAppearance = (event: Event) => {
            const value: unknown = (event as CustomEvent).detail;
            // The app's setting is already stored, marked as chosen or not: read it as the web does.
            if (typeof value === 'string' && isThemePreference(value)) setThemePreference(readThemePreference());
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
            return;
        }

        // A 13 to 15-year-old's account waits for a parent; the server answers nothing else meanwhile.
        if (user.accountState === 'AWAITING_PARENT' && location.pathname !== WAITING_FOR_PARENT_PATH) {
            navigate(WAITING_FOR_PARENT_PATH, { replace: true });
        }
    }, [location.pathname, navigate, status, user]);

    const effectiveTheme = themeForRoute(themePreference);

    // Only a choice is stored (`chooseTheme`): storing on every visit made the old dark default look chosen.
    useLayoutEffect(() => { applyDocumentTheme(effectiveTheme); }, [effectiveTheme]);
    const chooseTheme = (value: ThemePreference) => { chooseThemePreference(value); setThemePreference(value); };

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
        beginExplicitSignOut();
        const endingSession = logout();
        // Leave private routes now: a delayed response must not capture their address or redirect a later account.
        navigate('/login', { replace: true });
        await endingSession;
    };

    const isLandingPage = location.pathname === '/';
    const isWorldPage = location.pathname === '/world' || location.pathname.startsWith('/world/');
    const isWorldMap = location.pathname === '/world/map';
    const isAuthPage = authRoutePaths.has(location.pathname) || location.pathname === '/oauth2/callback';
    const isHomeFeed = location.pathname === '/home' || location.pathname === '/feed';
    const isClubSurfaceRoute = /^\/clubs\/\d+(\/squads|\/workspace|\/operations|\/profile-settings|\/store|\/campaigns|\/jobs)?$/.test(location.pathname);
    // Public destination pages with full-bleed heroes (banner + tab bars) render
    // edge-to-edge; everything else keeps the bounded wide frame.
    const isBleedDestinationPage =
        (isWorldPage && !isWorldMap) ||
        /^\/clubs\/\d+$/.test(location.pathname) ||
        /^\/organizations\/\d+$/.test(location.pathname) ||
        /^\/profile\/\d+$/.test(location.pathname);
    const isFullScreenPage =
        location.pathname === '/reports' || isWorldPage || location.pathname.startsWith('/admin/') || location.pathname.startsWith('/pages/requests/') ||
        location.pathname === '/requests' || location.pathname === '/events' ||
        location.pathname === '/tryouts' || location.pathname.startsWith('/tryouts/') ||
        location.pathname === '/admissions' || location.pathname.startsWith('/admissions/') ||
        location.pathname === '/club-operations' || location.pathname === '/me/staff-club' ||
        location.pathname === '/assistant' ||
        location.pathname === '/account/football' ||
        (isAndroidApp && location.pathname === '/app-settings') ||
        ['/map', '/messages', '/clubs', '/clubs/following', '/clubs/create', '/my-club', '/my-organizations', '/calendar', '/notifications', '/onboarding', '/set-password', '/account', '/admin', '/team-work', '/team-work/chat', '/tournaments', '/store', '/jobs', '/roles', '/campaigns'].includes(location.pathname) ||
        location.pathname === '/parent' ||
        location.pathname.startsWith('/match-exchange') || location.pathname === '/match-history' || location.pathname.startsWith('/referees/') ||
        location.pathname === '/my-squads' || location.pathname === '/squads' || location.pathname.startsWith('/squads/') ||
        location.pathname.startsWith('/profile') ||
        location.pathname.startsWith('/posts/') ||
        location.pathname.startsWith('/store/') ||
        location.pathname === '/stadiums' || location.pathname.startsWith('/stadiums/') ||
        location.pathname.startsWith('/jobs/') || location.pathname.startsWith('/roles/') ||
        location.pathname.startsWith('/campaigns/') ||
        location.pathname.startsWith('/organizations') ||
        location.pathname.startsWith('/join/') || location.pathname.startsWith('/invite/') || location.pathname.startsWith('/staff-invite/') ||
        location.pathname.startsWith('/tournaments/') ||
        location.pathname.startsWith('/agent') ||
        isClubSurfaceRoute;
    const isBoundedCanvasPage = boundedCanvasPages.has(location.pathname) || isWorldMap;
    // W6 â€” one shell: browse/list/destination pages share a single App-level
    // frame (app-page-shell + AppPageFrame, one max-width); the map, chat,
    // schedule and the management workspaces stay full-width canvases.
    const canvasWorkspacePages = new Set(['/map', '/messages', '/team-work/chat', '/onboarding', '/set-password']);
    const isImmersiveCanvasPage =
        /^\/clubs\/\d+\/operations$/.test(location.pathname) ||
        canvasWorkspacePages.has(location.pathname) || isWorldMap ||
        /^\/clubs\/\d+\/workspace$/.test(location.pathname) ||
        /^\/tournaments\/\d+\/workspace$/.test(location.pathname);
    const hasProductNavigation = !isAndroidApp && !isLandingPage && !isAuthPage;
    const showsHeader = hasProductNavigation;
    const activeHeaderHeight = showsHeader ? 'var(--app-header-height)' : '0px';

    const fullScreenRoutes = (
        <RouteViewport><Routes>
            <Route path="/assistant" element={<ProtectedRoute><AgentDolaPage /></ProtectedRoute>} />
            <Route path="/map" element={<WorldRedirect to="/world/map" />} />
            <Route path="/world/*" element={<WorldRoutes />} />
            <Route path="/clubs" element={<WorldRedirect to="/world/clubs" rename={{ search: 'q' }} />} />
            <Route path="/clubs/following" element={<ProtectedRoute><WorldRedirect to="/world/clubs" set={{ view: 'following' }} /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarRedirect /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><LegacyCleanupRedirect kind="notifications" /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute>{isAndroidApp ? <PageBootSpinner label="Opening messages" /> : <MessagingPage />}</ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
            <Route path="/requests" element={<ProtectedRoute><RequestsCentre /></ProtectedRoute>} />
            <Route path="/events" element={<WorldRedirect to="/world/matches" set={{ tab: 'events' }} />} />
            <Route path="/tryouts" element={<WorldRedirect to="/world/opportunities" set={{ tab: 'trials' }} />} />
            <Route path="/tryouts/:tryoutId" element={<TryoutDetailPage />} />
            <Route path="/admissions/opportunities" element={<WorldRedirect to="/world/opportunities" set={{ tab: 'groups' }} />} />
            <Route path="/admissions/opportunities/:opportunityId" element={<OpportunityDetailPage />} />
            <Route path="/admissions/cases/:caseId" element={<ProtectedRoute><AdmissionCasePage /></ProtectedRoute>} />
            <Route path="/admissions" element={<ProtectedRoute><AdmissionHomePage /></ProtectedRoute>} />
            <Route path="/admissions/groups/:groupId/schedule" element={<ProtectedRoute><AdmissionGroupSchedulePage /></ProtectedRoute>} />
            <Route path="/admissions/organizations/:organizationId/inquire" element={<ProtectedRoute><GeneralAdmissionInquiryPage /></ProtectedRoute>} />
            <Route path="/admissions/inquiries/:inquiryId" element={<ProtectedRoute><AdmissionInquiryPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportReceipts /></ProtectedRoute>} />
            <Route path="/account/football" element={<ProtectedRoute><FootballProfilePage /></ProtectedRoute>} />
            <Route path="/match-exchange" element={<LegacyMatchesRedirect kind="exchange" />} />
            <Route path="/match-history" element={<LegacyMatchesRedirect kind="history" />} />
            <Route path="/match-exchange/:eventId" element={<ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
            <Route path="/referees/:refereeId" element={<ProtectedRoute><RefereePage /></ProtectedRoute>} />
            <Route path="/parent" element={<ProtectedRoute><ParentHubPage /></ProtectedRoute>} />
            <Route path="/my-squads" element={<ProtectedRoute><CoachWorkspacePage /></ProtectedRoute>} />
            <Route path="/squads" element={<ProtectedRoute><MySquadsPage /></ProtectedRoute>} />
            <Route path="/squads/:squadId" element={<ProtectedRoute><SquadCommunicationPage /></ProtectedRoute>} />
            {isAndroidApp && <Route path="/app-settings" element={<AppSettingsPage theme={themePreference} />} />}
            <Route path="/tournaments" element={<LegacyMatchesRedirect kind="competitions" />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:tournamentId/workspace" element={<ProtectedRoute><TournamentWorkspacePage /></ProtectedRoute>} />
            <Route path="/organizations/create" element={<ProtectedRoute><CreateRedirect /></ProtectedRoute>} />
            <Route path="/organizations/:organizationId/workspace" element={<ProtectedRoute><OrganizationWorkspacePage /></ProtectedRoute>} />
            <Route path="/organizations/:organizationId" element={<ProtectedRoute><OrganizationProfilePage /></ProtectedRoute>} />
            <Route path="/admin" element={<SystemAdminRoute><AdminPage /></SystemAdminRoute>} />
            <Route path="/team-work" element={<ProtectedRoute><TeamWorkPage /></ProtectedRoute>} />
            <Route path="/team-work/chat" element={<ProtectedRoute><TeamChatPage /></ProtectedRoute>} />
            <Route path="/admin/page-reviews" element={<SystemAdminRoute><PageReviewQueue /></SystemAdminRoute>} />
            <Route path="/pages/requests/:reviewId" element={<ProtectedRoute><PageReviewReceipt /></ProtectedRoute>} />
            <Route path="/profile/me" element={<ProtectedRoute><MyProfileRedirect /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<PersonProfilePage />} />
            <Route path="/posts/:postId" element={<PostPage />} />
            <Route path="/agent" element={<ProtectedRoute><AgentDashboardPage /></ProtectedRoute>} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/store/all" element={<StoreCataloguePage />} />
            <Route path="/stadiums" element={<WorldRedirect to="/world/venues" />} />
            <Route path="/stadiums/:organizationId" element={<StadiumProfilePage />} />
            <Route path="/stadiums/:organizationId/manage" element={<ProtectedRoute><StadiumWorkspacePage /></ProtectedRoute>} />
            <Route path="/store/products/:id" element={<StoreProductPage />} />
            <Route path="/store/cart" element={<StoreCartPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/all" element={<JobsCataloguePage />} />
            <Route path="/jobs/new" element={<PostJobPage />} />
            <Route path="/clubs/:id/jobs" element={<ClubJobsPage />} />
            {ROLE_DIRECTORY_ROUTE_PATHS.map(path => <Route key={path} path={path} element={<WorldRedirect to="/jobs" rename={{ search: 'query', engagement: 'terms' }} detail={{ key: 'job', path: '/jobs' }} />} />)}
            {ROLE_DETAIL_ROUTE_PATHS.map(path => <Route key={path} path={path} element={<JobDetailPage />} />)}
            <Route path="/campaigns" element={<FundraisingPage />} />
            <Route path="/campaigns/all" element={<FundraisingCataloguePage />} />
            <Route path="/campaigns/new" element={<ProtectedRoute><StartFundraiserPage /></ProtectedRoute>} />
            <Route path="/campaigns/:id" element={<FundraiserPage />} />
            <Route path="/campaigns/:id/manage/:tool" element={<ProtectedRoute><FundraiserManagePage /></ProtectedRoute>} />
            <Route path="/clubs/:id/campaigns" element={<ClubFundraisingPage />} />
            <Route path="/clubs/:id/store" element={<ClubStorePage />} />
            <Route path="/clubs/:id/squads" element={<ProtectedRoute><LegacyCleanupRedirect kind="squads" /></ProtectedRoute>} />
            <Route path="/clubs/:id/profile-settings" element={<ProtectedRoute><ClubPublicProfileSettingsPage /></ProtectedRoute>} />
            <Route path="/clubs/:id/operations" element={<ProtectedRoute><ClubOperationsPage /></ProtectedRoute>} />
            <Route path="/club-operations" element={<ProtectedRoute><LegacyCleanupRedirect kind="connections" /></ProtectedRoute>} />
            <Route path="/clubs/:id/workspace" element={<ProtectedRoute><ClubWorkspacePage /></ProtectedRoute>} />
            <Route path="/clubs/:id" element={<ClubProfilePage />} />
            <Route path="/clubs/create" element={<ProtectedRoute><CreateRedirect kind="CLUB" /></ProtectedRoute>} />
            <Route path="/my-organizations" element={<ProtectedRoute><MyOrganizationsPage /></ProtectedRoute>} />
            <Route path="/my-club" element={<ProtectedRoute><MyClubPage /></ProtectedRoute>} />
            {/* Public: the squad and club show before sign-in; asking to join signs in first. */}
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/staff-invite/:code" element={<StaffLinkPage />} />
            <Route path="/me/staff-club" element={<ProtectedRoute><StaffClubPage /></ProtectedRoute>} />
            <Route path="/invite/:code" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="/set-password" element={<ProtectedRoute><SetPasswordPage /></ProtectedRoute>} />
            <Route path="*" element={<RouteRecoveryPage />} />
        </Routes></RouteViewport>
    );

    return (
        <div
            className={`${hasProductNavigation ? 'product-app-shell' : ''} min-h-screen bg-[color:var(--theme-page)] text-[color:var(--text-primary)] transition-colors duration-200`}
            data-tabbar={showsHeader && !!user}
            style={{ '--app-active-header-height': activeHeaderHeight } as CSSProperties}
        >
            <RouteMetadata />
            {showsHeader && (
                <AppHeader user={user} myClubId={myClubId} themePreference={themePreference} setThemePreference={chooseTheme} onLogout={() => void handleLogout()} />
            )}
            {showsHeader && <ParentApprovalBanner />}

            {isLandingPage || isAuthPage ? (
                <main>
                    <RouteViewport><Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
                        <Route path="/signup" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
                        <Route path="/register" element={<Navigate to="/signup" replace />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/club-invite" element={<ClubInvitePage />} />
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/consent" element={<ConsentPage />} />
                        <Route path="/parent-approval" element={<ParentApprovalPage />} />
                        <Route path="/own-account" element={<OwnAccountPage />} />
                        <Route path={WAITING_FOR_PARENT_PATH} element={<ProtectedRoute><WaitingForParentPage /></ProtectedRoute>} />
                        <Route path="/start" element={<ProtectedRoute><Navigate to={`/home?${WELCOME_PARAM}=start`} replace /></ProtectedRoute>} />
                        <Route path="/oauth2/callback" element={<OAuth2RedirectHandler />} />
                    </Routes></RouteViewport>
                </main>
            ) : isFullScreenPage ? (
                isImmersiveCanvasPage ? (
                    <main
                        className={`relative w-full ${isBoundedCanvasPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
                        style={showsHeader
                            ? { minHeight: 'calc(100dvh - var(--app-header-height) - var(--app-bottom-bar-height))', height: 'calc(100dvh - var(--app-header-height) - var(--app-bottom-bar-height))' }
                            : { minHeight: '100dvh', height: '100dvh' }}
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
                            {LeftSidebar && railsFit && <Suspense fallback={null}><LeftSidebar user={user} /></Suspense>}

                        <main className="min-w-0">
                            <RouteViewport><Routes>
                                <Route path="/home" element={<ProtectedRoute><FeedPage user={user} managedClubs={managedClubs} /></ProtectedRoute>} />
                                <Route path="/feed" element={<Navigate to={`/home${location.search}`} replace />} />
                                <Route path="*" element={<RouteRecoveryPage />} />
                            </Routes></RouteViewport>
                        </main>

                        {RightSidebar && railsFit && <Suspense fallback={null}><RightSidebar /></Suspense>}
                    </div>
                </div>
            )}
            {/* The start sheet opens over whatever page says `?create=`, an action's flow over whatever page says `?do=`. */}
            <CreatePageHost />
            <ActionHost />
            {/* The frame's one floating corner: "Your first week" now, the Dola guide later. */}
            {showsHeader && user && <CornerDock><Suspense fallback={null}><FirstWeek /></Suspense></CornerDock>}
        </div>
    );
}

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <AuthSessionBoundary><DolaProvider><MainLayout /><Suspense fallback={null}><DolaDock /></Suspense></DolaProvider></AuthSessionBoundary>
            </AuthProvider>
        </Router>
    );
}
