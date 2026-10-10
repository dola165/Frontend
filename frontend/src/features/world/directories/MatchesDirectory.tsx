import { CalendarPlus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { get, type Squad } from '../../matchExchange/api';
import { useWorldCopy } from '../copy';
import { DirectoryPage } from '../directory/DirectoryPage';
import { useWorldData } from '../useWorldData';
import { arrangements, events, exchange, fixtures } from './matchSources';

/** Squads the person can arrange matches for; arranging is offered only when there are some. */
function useArrangeableSquads() {
    const { status, sessionId } = useAuth();
    return useWorldData(status === 'authenticated' ? `arrange-squads:${sessionId}` : null, signal => get<Squad[]>('/match-exchange/squads', undefined, signal));
}

const SOURCES = [fixtures, exchange, arrangements, events];

/**
 * World › Matches: fixtures and results, open matches, my arrangements and every published event.
 * Guests open on the published events, the one list they can see without signing in.
 */
export default function MatchesDirectory() {
    const t = useWorldCopy();
    const squads = useArrangeableSquads();
    return (
        <DirectoryPage
            title={t('Matches')}
            subtitle={t('Fixtures and results across clubs and competitions, teams looking for an opponent, and your own arrangements.')}
            sources={SOURCES}
            actions={squads.data?.length ? <ButtonLink variant="primary" to="/world/matches/arrange"><CalendarPlus aria-hidden="true" />{t('Arrange a match')}</ButtonLink> : undefined}
        />
    );
}
