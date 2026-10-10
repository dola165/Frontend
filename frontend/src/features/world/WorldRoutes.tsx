import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { buildLoginRedirectPath } from '../../utils/authRedirect';
import { Skeleton } from '../../design/primitives';
import { WorldLayout } from './WorldLayout';
import { WorldSessionProvider } from './WorldSessionProvider';

const WorldFrontPage = lazy(() => import('./front/WorldFrontPage'));
const WorldMapPage = lazy(() => import('./map/WorldMapPage'));
const ClubsDirectory = lazy(() => import('./directories/ClubsDirectory'));
const PeopleDirectory = lazy(() => import('./directories/PeopleDirectory'));
const VenuesDirectory = lazy(() => import('./directories/VenuesDirectory'));
const MatchesDirectory = lazy(() => import('./directories/MatchesDirectory'));
const CompetitionsDirectory = lazy(() => import('./directories/CompetitionsDirectory'));
const OpportunitiesDirectory = lazy(() => import('./directories/OpportunitiesDirectory'));
const ArrangeMatchPage = lazy(() => import('./directories/ArrangeMatchPage'));

const PageLoading = () => (
    <div className="gk-world-loading" role="status" aria-label="Loading">
        <Skeleton height={34} width="32%" /><Skeleton height={44} /><Skeleton height={220} />
    </div>
);

/** Club work started from World (arranging a match) needs an account. */
function ProtectedRoute({ children }: { children: ReactNode }) {
    const location = useLocation();
    const { status } = useAuth();
    if (status === 'bootstrapping') return <PageLoading />;
    if (status !== 'authenticated') return <Navigate replace to={buildLoginRedirectPath(location.pathname, location.search, location.hash)} />;
    return <>{children}</>;
}

/** `/world` used to be the map; links that point at a place on it still open the map. */
function WorldIndex() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    if (['opportunity', 'venue', 'plans'].some(key => params.has(key))) return <Navigate replace to={{ pathname: '/world/map', search: location.search, hash: location.hash }} />;
    return <WorldFrontPage />;
}

/** GrassKickZ World: the discovery home, its directories and the full map. */
export default function WorldRoutes({ darkMode }: { darkMode: boolean }) {
    return (
        <WorldSessionProvider><Routes>
            <Route path="map" element={<Suspense fallback={null}><WorldMapPage darkMode={darkMode} /></Suspense>} />
            <Route element={<WorldLayout />}>
                <Route index element={<Suspense fallback={<PageLoading />}><WorldIndex /></Suspense>} />
                <Route path="clubs" element={<Suspense fallback={<PageLoading />}><ClubsDirectory /></Suspense>} />
                <Route path="people" element={<Suspense fallback={<PageLoading />}><PeopleDirectory /></Suspense>} />
                <Route path="venues" element={<Suspense fallback={<PageLoading />}><VenuesDirectory /></Suspense>} />
                <Route path="matches" element={<Suspense fallback={<PageLoading />}><MatchesDirectory /></Suspense>} />
                <Route path="matches/arrange" element={<ProtectedRoute><Suspense fallback={<PageLoading />}><ArrangeMatchPage /></Suspense></ProtectedRoute>} />
                <Route path="competitions" element={<Suspense fallback={<PageLoading />}><CompetitionsDirectory /></Suspense>} />
                <Route path="opportunities" element={<Suspense fallback={<PageLoading />}><OpportunitiesDirectory /></Suspense>} />
                <Route path="*" element={<Navigate replace to="/world" />} />
            </Route>
        </Routes></WorldSessionProvider>
    );
}
