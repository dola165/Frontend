import { useWorldCopy } from '../../copy';
import { useMapCounterpart } from '../../directory/selection';
import { peekOf } from '../../peek/usePeek';
import { fixtureDay, shortDate } from '../../format';
import { endOf } from '../../scoreboard/form';
import { lineState } from '../../scoreboard/lineState';
import { matchPagePath } from '../../scoreboard/matchCode';
import { matchState } from '../../scoreboard/matchState';
import { MatchLine, WaitTag } from '../../scoreboard/Scoreboard';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { useNow } from '../../scoreboard/useNow';
import type { Fixture } from './fixtures';

/**
 * A fixture or result as a score line: crests, the club (and its squad only when the two squads differ), my teams
 * starred, the state worked out honestly, and one quiet tag: what is owed, else my match's ground, else the squad both
 * sides share.
 */
export function FixtureLine({ item: f }: { item: Fixture }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const linked = useMapCounterpart();
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
    const tag = state.tag ? (state.code === 'before' ? t(state.tag.word, state.tag.vars) : <WaitTag tone={state.tag.tone}>{t(state.tag.word, state.tag.vars)}</WaitTag>)
        : own && m.locationName ? m.locationName.split(',')[0] : sameSquad ? m.homeSquadName : undefined;
    return (
        <MatchLine to={matchPagePath(m)} peek={peekOf('match', f.code)} linked={linked} title={[m.tournamentName, m.locationName].filter(Boolean).join(' · ') || undefined} {...lineState(state, t)}
            day={!f.showDay ? undefined : state.code === 'ft' ? shortDate(m.startsAt) ?? undefined : fixtureDay(m.startsAt, m.timezone)}
            home={side('home')} away={side('away')} tag={tag} faint={state.faint} />
    );
}
