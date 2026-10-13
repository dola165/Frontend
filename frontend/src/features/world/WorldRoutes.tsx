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

/** `/world` is the Map; links that point at a place or a plan on the old full map still open Journeys. */
function WorldIndex() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    if (['opportunity', 'venue', 'plans'].some(key => params.has(key))) return <Navigate replace to={{ pathname: '/world/map', search: location.search, hash: location.hash }} />;
    return <MapDirectory />;
}

/** GrassKickZ World: the map, its directories and Journeys (the old full map). Venues are out for now. */
export default function WorldRoutes() {
    return (
        <WorldSessionProvider><Routes>
            <Route path="map" element={<Suspense fallback={null}><WorldMapPage /></Suspense>} />
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
