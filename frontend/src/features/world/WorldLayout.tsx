import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { GkRoot, PageFrame } from '../../design/primitives';
import { WorldWelcome } from '../firstWeek/WorldWelcome';
import { WorldStage } from './stage/WorldStage';
import { WorldContextBar } from './WorldContextBar';
import { WorldNav } from './WorldNav';
import './world.css';

/** Every World tab's code, fetched once in the background so moving between tabs never waits on a download. */
const preloadTabs = () => Promise.allSettled([
    import('./directories/MapDirectory'), import('./directories/ClubsDirectory'), import('./directories/OpportunitiesDirectory'),
    import('./directories/MatchesDirectory'), import('./directories/TournamentsDirectory'), import('./directories/PeopleDirectory'),
]);

/**
 * Every World page except the full map: the World navigation, with who and where World is for beside it, and the
 * stage (the header row, the map, the page) that stays in place as the person moves between tabs.
 */
export function WorldLayout() {
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 400));
        idle(() => void preloadTabs());
    }, []);
    return (
        <GkRoot className="gk-page gk-world">
            <PageFrame>
                <WorldWelcome />
                <div className="gk-world-bar">
                    <WorldNav />
                    <WorldContextBar />
                </div>
                <WorldStage><Outlet /></WorldStage>
            </PageFrame>
        </GkRoot>
    );
}
