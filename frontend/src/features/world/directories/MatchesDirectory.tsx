import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { get, type Squad } from '../../matchExchange/api';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { isoDay } from '../format';
import { COACHING_ROLES } from '../front/coach/mySquads';
import type { WorldRole } from '../front/roles';
import { useWorldRole } from '../front/useOverviewLayout';
import { useWorldData } from '../useWorldData';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { fixtures } from './matches/fixturesSource';
import { loadWindow, openingDay } from './matches/matchday';
import { exchange } from './matches/exchangeSource';
import { arrangements, events } from './matches/otherSources';

/** Squads the person can arrange matches for; arranging is offered only when there are some. */
function useArrangeableSquads() {
    const { status, sessionId } = useAuth();
    return useWorldData(status === 'authenticated' ? `arrange-squads:${sessionId}` : null, signal => get<Squad[]>('/match-exchange/squads', undefined, signal));
}

const SOURCES = [fixtures, exchange, arrangements, events];
/** The tab Matches opens on for each role, when the address names none: a referee looks for matches to officiate, a team manager at what needs arranging. */
const OPENING: Partial<Record<WorldRole, string>> = { referee: 'exchange', 'team-manager': 'mine' };
const WINDOW_KEYS = ['source', 'mine', 'clubId', 'squadId', 'tournamentId', 'resultStatus', 'q'];

/**
 * Fixtures opens on a day: today when it has matches, else the next matchday (or the list of everything to come when
 * nothing is on in the next week). The list already shows that day while this looks it up; once known, the day is
 * written to the address (without a history entry), so the strip, Back and a copied link all agree.
 */
function useOpeningDay(opening: string, role: WorldRole) {
    const { status, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const onFixtures = (params.get('tab') ?? opening) === 'fixtures';
    const needed = status === 'authenticated' && onFixtures && !params.has('day') && !params.has('period');
    // The window as the list will ask for it, with the person's own teams when that is how the tab opens for them.
    const filters = new URLSearchParams();
    for (const key of WINDOW_KEYS) if (params.get(key)) filters.set(key, params.get(key)!);
    if (!filters.has('mine') && [...filters.keys()].length === 0 && (COACHING_ROLES.has(role) || role === 'player')) filters.set('mine', 'true');
    const key = filters.toString();
    useEffect(() => {
        if (!needed) return;
        let live = true;
        const today = isoDay(0);
        loadWindow(sessionId, key, today).then(window => {
            if (!live) return;
            const day = openingDay(window.counts, today);
            setParams(current => {
                if (current.has('day') || current.has('period')) return current;
                const next = new URLSearchParams(current);
                if (day) next.set('day', day); else next.set('period', 'UPCOMING');
                if (!next.has('tab')) next.set('tab', 'fixtures');
                return next;
            }, { replace: true, preventScrollReset: true });
        }).catch(() => undefined);
        return () => { live = false; };
    }, [needed, sessionId, key, setParams]);
}

/**
 * World › Matches: fixtures and results a day at a time, open matches, my arrangements and every published event.
 * Guests open on the published events, the one list they can see without signing in.
 */
export default function MatchesDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    const role = useWorldRole();
    const { membership } = useWorldSession();
    const [params] = useSearchParams();
    const squads = useArrangeableSquads();
    const opening = OPENING[role] ?? 'fixtures';
    useOpeningDay(opening, role);
    // The opening tab follows the role, which settles once the person's club is known.
    if (user && !params.has('tab') && membership === undefined) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Matches')}
            subtitle={t('Fixtures, results and open matches')}
            sources={SOURCES}
            opening={opening}
            actions={squads.data?.length ? <ButtonLink variant="primary" to="/world/matches/arrange"><CalendarPlus aria-hidden="true" />{t('Arrange a match')}</ButtonLink> : undefined}
        />
    );
}
