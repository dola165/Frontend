import { lazy, Suspense } from 'react';
import type { JoiningChild } from '../../joining-contract/types';

const ClubFinder = lazy(() => import('./ClubFinder'));

/**
 * World's club map in Parent Hub's one pop-up (`find=club`). World's code arrives only when the pop-up opens; until then
 * the page behind stays as it is.
 */
export function ClubFinderHost({ families, onBooked }: { families: JoiningChild[]; onBooked: () => void }) {
    return <Suspense fallback={null}><ClubFinder families={families} onChanged={onBooked} /></Suspense>;
}
