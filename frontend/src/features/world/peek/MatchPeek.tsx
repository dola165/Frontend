import { Button, EmptyNote } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { notifyWorldChanged } from '../cache';
import { useWorldCopy } from '../copy';
import { fixtureTitle } from '../directories/matches/matchPlaces';
import { endOf } from '../scoreboard/form';
import { matchPagePath } from '../scoreboard/matchCode';
import { matchState } from '../scoreboard/matchState';
import { doubtMatch } from '../scoreboard/matchRegistry';
import { loadMyTeams, NO_TEAMS, sideIsMine } from '../scoreboard/myTeams';
import { useNow } from '../scoreboard/useNow';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { trackOf } from '../scoreboard/lanes';
import { Track } from '../scoreboard/Track';
import { MatchAction } from './match/MatchAction';
import { MatchForm } from './match/MatchForm';
import { MatchHead } from './match/MatchHead';
import { useMatchPeek } from './match/matchPeekData';
import { StageTable } from './match/MatchTable';
import './peek.css';
import './match/match-peek.css';

/** What changes when a match's result, offers or players change: every list that shows matches asks again. */
const MATCH_LISTS = ['listing:', 'history:', 'matchday:', 'arrangements:'];

/**
 * A match over World, from the right, as score sites open a fixture: both clubs (each opens on the left), the score
 * once it counts or the kick-off, the tournament (on the left too) and the ground; the one thing to do with it now;
 * its table; both sides' form and their last meeting. The full match page is one link away.
 */
export default function MatchPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { sessionId } = useAuth();
    const now = useNow();
    const peek = useMatchPeek(id);
    const teams = useWorldData(`my-teams:${sessionId}`, () => loadMyTeams(sessionId)).data ?? NO_TEAMS;
    if (peek.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (!peek.data) return (
        <DrawerFrame title={t('Match')}>
            <EmptyNote title={peek.error || t('This match could not load.')} action={peek.missing && !peek.error ? undefined : <Button size="sm" onClick={peek.retry}>{t('Try again')}</Button>} />
        </DrawerFrame>
    );
    const { match: m, tournament, fixture, listing } = peek.data;
    // Arranging work is "mine" only at the clubs whose squads I may arrange for (never as a player or parent).
    const track = listing && listing.opponent_club_id != null ? trackOf(listing, { clubIds: teams.arrangeClubIds, now }) : [];
    const mine = { home: sideIsMine(endOf(m, 'home'), teams), away: sideIsMine(endOf(m, 'away'), teams) };
    const state = matchState(m, now, mine.home || mine.away);
    // A club fixture has no match page; its club's own staff open it in their calendar.
    const page = m.source === 'SCHEDULE'
        ? (m.homeClubId != null && teams.arrangeClubIds.has(m.homeClubId) ? { to: m.detailPath, label: t('Open in calendar') } : undefined)
        : { to: matchPagePath(m), label: m.source === 'TOURNAMENT' ? t('Tournament page') : t('Match page') };
    // After an action the list's row may be out of date: the drawer reads the match again.
    const reload = () => { doubtMatch(sessionId, id); notifyWorldChanged(MATCH_LISTS); peek.retry(); };
    return (
        <DrawerFrame title={fixtureTitle(m)} page={page}>
            <MatchHead match={m} state={state} mine={mine} />
            {track.length > 0 && <section className="gk-peek-section"><h3 className="gk-peek-section__title">{t('What this match needs')}</h3><Track dots={track} words /></section>}
            <MatchAction data={peek.data} reload={reload} />
            {tournament && fixture && <StageTable tournament={tournament} stageId={fixture.stageId} label={t('Table')} level={3}
                mine={new Set(tournament.entries.filter(entry => sideIsMine({ clubId: entry.clubId, squadId: entry.squadId }, teams)).map(entry => entry.id))}
                marked={new Set([fixture.homeEntryId, fixture.awayEntryId].filter((entry): entry is number => entry != null))} />}
            <MatchForm match={m} />
        </DrawerFrame>
    );
}
