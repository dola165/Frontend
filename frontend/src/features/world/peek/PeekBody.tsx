import { lazy, Suspense, type ComponentType } from 'react';
import { useWorldCopy } from '../copy';
import { DrawerPlaceContext, type DrawerPlace } from './drawerContext';
import type { DrawerKind } from './kinds';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';

/** What each kind of thing shows, loaded when first opened. */
const KINDS: Record<DrawerKind, ComponentType<{ id: string }>> = {
    person: lazy(() => import('./PersonPeek')),
    job: lazy(() => import('./JobPeek')),
    club: lazy(() => import('./ClubPeek')),
    match: lazy(() => import('./MatchPeek')),
    tournament: lazy(() => import('./TournamentPeek')),
    venue: lazy(() => import('./VenuePeek')),
    trial: lazy(() => import('./TrialPeek')),
    group: lazy(() => import('./GroupPeek')),
    arrange: lazy(() => import('./ArrangePeek')),
    organiser: lazy(() => import('./OrganiserPeek')),
    draw: lazy(() => import('./DrawPeek')),
};

/** One thing, in a drawer or in the pane beside the list: the same body either way. */
export function PeekBody({ kind, id, ...place }: { kind: string; id: string } & DrawerPlace) {
    const t = useWorldCopy();
    const Kind = KINDS[kind as DrawerKind];
    return (
        <DrawerPlaceContext.Provider value={place}>
            <Suspense fallback={<DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>}>
                <Kind key={`${kind}-${id}`} id={id} />
            </Suspense>
        </DrawerPlaceContext.Provider>
    );
}
