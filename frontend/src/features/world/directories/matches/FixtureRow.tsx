import { Status } from '../../../../design/DataTable';
import { ActionButton } from '../../../actions/ActionButton';
import { useWorldCopy } from '../../copy';
import { MatchRow } from '../../directory/MatchRow';
import { peekOf } from '../../peek/usePeek';
import { fixtureDay, shortDate } from '../../format';
import { endOf } from '../../scoreboard/form';
import { matchPagePath } from '../../scoreboard/matchCode';
import { matchState, type WhenTone } from '../../scoreboard/matchState';
import { WaitTag } from '../../scoreboard/Scoreboard';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { useNow } from '../../scoreboard/useNow';
import type { Fixture } from './fixtures';

const TONE: Record<WhenTone, 'danger' | 'accent' | 'neutral'> = { danger: 'danger', accent: 'accent', muted: 'neutral' };

/**
 * A fixture or result as a row: crests and the clubs (with their squads only when the two differ), my teams starred,
 * when and where under it, and at the end the score once it counts, else what is owed (a waiting item) or the state
 * worked out honestly (FT, Canc., On now by the schedule). A result of my own team offers "Play again": a new match with
 * that opponent, from the same squad.
 */
export function FixtureRow({ item: f }: { item: Fixture }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const now = useNow();
    const { m } = f;
    const own = f.mine.home || f.mine.away;
    const state = matchState(m, now, own);
    const sameSquad = Boolean(m.homeSquadName && m.homeSquadName === m.awaySquadName);
    const side = (end: 'home' | 'away') => {
        const team = endOf(m, end);
        return { name: team.club ? (sameSquad || !team.squad ? team.club : `${team.club} ${team.squad}`) : t('To be decided'), logo: crestOf(team.clubId),
            score: state.score?.[end] ?? null, mine: f.mine[end], muted: !team.club };
    };
    const when = 'time' in state.when ? state.when.time : t(state.when.word);
    const day = !f.showDay ? null : state.code === 'ft' ? shortDate(m.startsAt) : fixtureDay(m.startsAt, m.timezone);
    const where = [when, day, m.tournamentName, m.locationName?.split(',')[0]].filter(Boolean).join(' · ');
    // Something owed is a waiting item (a dot, the word, an arrow); "in 2 h" is just said; a state in place of a time says itself.
    const aside = state.tag ? (state.code === 'before' ? <span className="gk-faint">{t(state.tag.word, state.tag.vars)}</span> : <WaitTag tone={state.tag.tone}>{t(state.tag.word, state.tag.vars)}</WaitTag>)
        : !('time' in state.when) && !state.score ? <Status tone={TONE[state.when.tone ?? 'muted']} title={state.when.spoken && t(state.when.spoken)}>{t(state.when.word)}</Status> : undefined;
    const again = state.code === 'ft' && own ? { mine: endOf(m, f.mine.home ? 'home' : 'away'), them: endOf(m, f.mine.home ? 'away' : 'home') } : null;
    const action = again?.them.clubId ? <ActionButton action="arrange_match" subject={again.mine.squadId ? { kind: 'squad', id: again.mine.squadId } : { kind: 'me' }}
        hints={{ opponentId: again.them.clubId }} size="sm" variant="ghost" label={t('Play again')} /> : undefined;
    return (
        <MatchRow to={matchPagePath(m)} peek={peekOf('match', f.code)} title={[m.tournamentName, m.locationName].filter(Boolean).join(' · ') || undefined}
            home={side('home')} away={side('away')} lines={[where, sameSquad ? m.homeSquadName : null]} aside={aside} action={action} />
    );
}
