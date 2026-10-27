import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Megaphone, Send } from 'lucide-react';
import { ButtonLink, EmptyNote } from '../../../design/primitives';
import { Segmented } from '../../../design/Tabs';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { ArrangeMatchForm } from '../../matchExchange/arrange/ArrangeMatchForm';
import { notifyWorldChanged } from '../cache';
import { arrangeDraftKey, arrangePeek, arrangeSeed, NEW_MATCH_LISTS, parseArrangeSeed } from '../compose/arrangeSeed';
import { useWorldCopy } from '../copy';
import { listingCode } from '../scoreboard/matchCode';
import { useDrawerPlace } from './drawerContext';
import { DrawerFrame } from './DrawerFrame';
import { peekOf, usePeek } from './usePeek';

/** The switch pressed last: the frame opens again for the other mode and gives focus back to it. */
let switched = false;
const markSwitched = () => { switched = true; };

/** Invite a club, or post an open match: the frame's two ways to find an opponent. */
function ModeSwitch({ value, onChange }: { value: 'direct' | 'open'; onChange: (mode: 'direct' | 'open') => void }) {
    const t = useWorldCopy();
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!switched) return;
        switched = false;
        root.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    }, []);
    return (
        <div ref={root}>
            <Segmented label={t('How to find an opponent')} value={value} className="gk-arrange__mode" onChange={mode => { markSwitched(); onChange(mode); }}
                items={[{ id: 'direct', label: t('Invite a club'), icon: <Send aria-hidden="true" /> }, { id: 'open', label: t('Anyone can propose'), icon: <Megaphone aria-hidden="true" /> }]} />
        </div>
    );
}

/**
 * Arrange a match in World's frame: beside the list when it was started there (a club's "Propose a match"), else in the
 * drawer on the right. Invite a club or post an open match, one short form with the match as it will look at the top.
 * Once sent, the match it created takes its place (its track and next step), and every list showing matches reloads.
 */
export default function ArrangePeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { user, sessionId, status } = useAuth();
    const location = useLocation();
    const drawers = usePeek();
    const { place } = useDrawerPlace();
    const seed = parseArrangeSeed(id);
    // A send that finishes after the frame was closed must not reopen anything: it only refreshes the lists.
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    // Beside the list the pane can start below the fold: the page moves just far enough for the pane to settle under the
    // header, where all of it shows, Send included (however long the form grows once it loads).
    useEffect(() => {
        const pane = place === 'pane' ? document.querySelector<HTMLElement>('.gk-world-pane') : null;
        if (!pane) return;
        const gap = pane.getBoundingClientRect().top - (parseFloat(getComputedStyle(pane).top) || 0);
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (gap > 1) window.scrollBy({ top: gap, behavior: reduce ? 'auto' : 'smooth' });
    }, [place]);
    const title = seed.mode === 'open' ? t('Post an open match') : t('Arrange a match');
    if (status !== 'authenticated' || !user) return (
        <DrawerFrame title={title}>
            <EmptyNote title={t('Sign in to arrange a match')} action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>} />
        </DrawerFrame>
    );
    const canonical = arrangeSeed(seed);
    const switcher = <ModeSwitch value={seed.mode} onChange={mode => drawers.open(arrangePeek({ mode, opponentId: seed.opponentId, squadId: seed.squadId }))} />;
    return (
        <DrawerFrame title={title}>
            <ArrangeMatchForm key={canonical} mode={seed.mode} opponentId={seed.opponentId} squadId={seed.squadId} head={switcher}
                storageKey={arrangeDraftKey(user.id, sessionId, canonical)}
                onSent={match => { notifyWorldChanged(NEW_MATCH_LISTS); if (mounted.current) drawers.open(peekOf('match', listingCode(match.event_id))); }} />
        </DrawerFrame>
    );
}
