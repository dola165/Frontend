import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ActionButton } from '../../actions/ActionButton';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { isoDay } from '../format';
import { COACHING_ROLES } from '../front/coach/mySquads';
import type { WorldRole } from '../front/roles';
import { useWorldRole } from '../front/useWorldRole';
import { WorldLoading } from '../WorldLoading';
import { useWorldSession } from '../worldSession';
import { fixtures } from './matches/fixturesSource';
import { loadWindow, openingDay, windowFilters } from './matches/matchday';
import { useWorldArea } from '../useWorldArea';
import { hasPublicCohort, useWorldFor } from '../searchContext';
import { CARRIED, effectiveDirectoryQuery, readQuery } from '../directory/useDirectoryState';
import { exchange } from './matches/exchangeSource';
import { events } from './matches/otherSources';

const SOURCES = [fixtures, exchange, events];
/** The tab Matches opens on for each role, when the address names none: a referee looks for matches to officiate. */
const OPENING: Partial<Record<WorldRole, string>> = { referee: 'exchange' };

/**
 * Fixtures opens on a day: today when it has matches, else the next matchday (or the list of everything to come when
 * nothing is on in the next week). The list already shows that day while this looks it up; once known, the day is
 * written to the address (without a history entry), so the strip, Back and a copied link all agree.
 */
function useOpeningDay(opening: string, role: WorldRole) {
    const { status, sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    const onFixtures = (params.get('tab') ?? opening) === 'fixtures';
    const { area } = useWorldArea();
    const context = useWorldFor();
    const requested = readQuery(fixtures, params).query;
    const explicit = requested.q || params.has('selected') || fixtures.filters.some(filter => !filter.nav && !CARRIED.includes(filter.key) && params.has(filter.key));
    if (!explicit && (COACHING_ROLES.has(role) || role === 'player')) requested.values.mine = ['true'];
    const query = effectiveDirectoryQuery(fixtures, requested, context, area);
    const needed = status === 'authenticated' && onFixtures && area.ready && !context.pending && !context.unavailable
        && !(context.missingCohort && !hasPublicCohort(query)) && !params.has('day') && !params.has('period');
    const key = windowFilters(query, area.country);
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
 * World › Matches, discovery only: fixtures and results a day at a time, open challenges and every published event. A
 * club's own match work is in My squads › Matches.
 * Guests open on the published events, the one list they can see without signing in.
 */
export default function MatchesDirectory() {
    const t = useWorldCopy();
    const { user } = useAuth();
    const role = useWorldRole();
    const { membership } = useWorldSession();
    const [params] = useSearchParams();
    const opening = OPENING[role] ?? 'fixtures';
    useOpeningDay(opening, role);
    // The opening tab follows the role, which settles once the person's club is known.
    if (user && !params.has('tab') && membership === undefined) return <WorldLoading />;
    return (
        <DirectoryPage
            title={t('Matches')}
            subtitle={t('Fixtures, results and open challenges')}
            sources={SOURCES}
            opening={opening}
            // Arranging is the one sheet; from World's matches it opens on posting an open challenge.
            actions={<ActionButton action="arrange_match" variant="primary" hints={{ way: 'open' }} label={t('Post an open challenge')} />}
        />
    );
}
