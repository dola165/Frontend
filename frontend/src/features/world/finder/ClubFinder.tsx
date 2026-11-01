import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router-dom';
import { Dialog } from '../../../design/Dialog';
import { GkRoot } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import type { JoiningChild } from '../../joining-contract/types';
import ClubsDirectory from '../directories/ClubsDirectory';
import { WorldStage } from '../stage/WorldStage';
import { WorldSessionProvider } from '../WorldSessionProvider';
import { FINDER_OPENED, FINDER_PARAMS, FinderContext } from './finderContext';
import '../world.css';
import './finder.css';

/**
 * The history entry Parent Hub's "Find a club near you" pushed to open the pop-up (its location key, followed through
 * the address changes made inside the pop-up, which replace it), so ✕ goes back over it like Back. Dropped as soon as
 * another entry shows or the pop-up closes: a link opened later (a shared group, an old group page) never sends ✕ back
 * to an unrelated page. Kept in memory only, so after a reload ✕ closes in place.
 */
let opened: string | null = null;

/**
 * Parent Hub's club finder (step 5): World's own club tab, the same map, list and filters, in one pop-up over the
 * child's page, set for the child (World's `player`: their birth year and gender, near the town they gave). A club opens
 * inside the list; booking, asking and sharing open inside it. Everything is in the address, so Back or ✕ returns to
 * the child's page as it was, and a shared link opens the same pop-up. On a phone it is the whole screen.
 */
export default function ClubFinder({ families, onChanged }: { families: JoiningChild[]; onChanged: () => void }) {
    const copy = useJourneyCopy();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const navigation = useNavigationType();
    const shown = useRef(location.key);
    useEffect(() => {
        if ((location.state as { finder?: string } | null)?.finder === FINDER_OPENED.finder) opened = location.key;
        else if (navigation === 'REPLACE' && opened === shown.current) opened = location.key;
        else if (location.key !== shown.current) opened = null;
        shown.current = location.key;
    }, [location.key, location.state, navigation]);
    useEffect(() => () => { opened = null; }, []);
    const close = () => {
        const pushed = opened !== null && opened === location.key;
        opened = null;
        if (pushed) navigate(-1);
        else setParams(current => { const next = new URLSearchParams(current); FINDER_PARAMS.forEach(key => next.delete(key)); return next; }, { replace: true });
    };
    const player = Number(params.get('player'));
    const child = families.find(item => item.playerId === player);
    const first = child?.identity.fullName.trim().split(/\s+/)[0];
    const born = child?.identity.dateOfBirth?.slice(0, 4);
    const value = useMemo(() => ({ family: families, changed: onChanged }), [families, onChanged]);
    return <Dialog open size="lg" className="gk-finder-dialog" onClose={close} closeLabel={copy('Close', 'დახურვა')}
        title={<span className="gk-finder__title" data-guide="club-search">{first ? copy(`Find a club for ${first}`, `კლუბი ${first}-სთვის`) : copy('Find a club', 'კლუბის ძებნა')}
            {born && <span className="gk-finder__born"> · {copy(`born ${born}`, `დაბ. ${born}`)}</span>}</span>}>
        <FinderContext.Provider value={value}>
            <WorldSessionProvider>
                <GkRoot className="gk-world gk-finder">
                    <WorldStage finder><ClubsDirectory finder /></WorldStage>
                </GkRoot>
            </WorldSessionProvider>
        </FinderContext.Provider>
    </Dialog>;
}
