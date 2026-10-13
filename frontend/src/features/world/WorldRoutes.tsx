import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { arrangePath } from './compose/arrangeSeed';
import { WorldLayout } from './WorldLayout';
import { WorldLoading as PageLoading } from './WorldLoading';
import { WorldSessionProvider } from './WorldSessionProvider';
import { TournamentsRedirect } from './WorldRedirect';

const MapDirectory = lazy(() => import('./directories/MapDirectory'));
const WorldMapPage = lazy(() => import('./map/WorldMapPage'));
const ClubsDirectory = lazy(() => import('./directories/ClubsDirectory'));
const PeopleDirectory = lazy(() => import('./directories/PeopleDirectory'));
const MatchesDirectory = lazy(() => import('./directories/MatchesDirectory'));
const TournamentsDirectory = lazy(() => import('./directories/TournamentsDirectory'));
const OpportunitiesDirectory = lazy(() => import('./directories/OpportunitiesDirectory'));

const positive = (value: string | null) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : undefined; };
/** The old Arrange a match page: World's Matches with the form open over it, filled in as the old address said. */
function ArrangeRedirect() {
    const params = new URLSearchParams(useLocation().search);
    const mode = params.get('mode') === 'open' ? 'open' : 'direct';
    return <Navigate replace to={arrangePath({ mode, opponentId: positive(params.get('opponent')), squadId: positive(params.get('squad')) })} />;
}

/** `/world` is the Map; a link to a plan on the old full map still opens journey planning. */
function WorldIndex() {
    const location = useLocation();
    if (new URLSearchParams(location.search).has('plans')) return <Navigate replace to={{ pathname: '/world/map', search: location.search, hash: location.hash }} />;
    return <MapDirectory />;
}

/**
 * The old full map is no longer a World place. Journey planning (Parent Hub, the club's records, "Plan a journey"
 * from a fixture) still links to `/world/map?plans=…` and keeps answering there until journeys get their own home;
 * any other old link (a venue, a place) opens the Map.
 */
function JourneysOrMap() {
    const location = useLocation();
    if (new URLSearchParams(location.search).has('plans')) return <Suspense fallback={null}><WorldMapPage /></Suspense>;
    return <Navigate replace to="/world" />;
}

/** GrassKickZ World: the map and its directories. Venues and Journeys are out for now. */
export default function WorldRoutes() {
    return (
        <WorldSessionProvider><Routes>
            <Route path="map" element={<JourneysOrMap />} />
            <Route element={<WorldLayout />}>
                <Route index element={<Suspense fallback={<PageLoading />}><WorldIndex /></Suspense>} />
                <Route path="clubs" element={<Suspense fallback={<PageLoading />}><ClubsDirectory /></Suspense>} />
                <Route path="people" element={<Suspense fallback={<PageLoading />}><PeopleDirectory /></Suspense>} />
                <Route path="venues" element={<Navigate replace to="/world" />} />
                <Route path="matches" element={<Suspense fallback={<PageLoading />}><MatchesDirectory /></Suspense>} />
                <Route path="matches/arrange" element={<ArrangeRedirect />} />
                <Route path="tournaments" element={<Suspense fallback={<PageLoading />}><TournamentsDirectory /></Suspense>} />
                <Route path="competitions" element={<TournamentsRedirect />} />
                <Route path="opportunities" element={<Suspense fallback={<PageLoading />}><OpportunitiesDirectory /></Suspense>} />
                <Route path="*" element={<Navigate replace to="/world" />} />
            </Route>
        </Routes></WorldSessionProvider>
    );
}
