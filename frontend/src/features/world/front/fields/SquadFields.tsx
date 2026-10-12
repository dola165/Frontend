import { EmptyNote } from '../../../../design/primitives';
import type { HistoryMatch } from '../../../matchHistory/api';
import { plural, useWorldCopy } from '../../copy';
import { fixtureDay, hasStarted } from '../../format';
import { fixturesLink, useNextOpponents, useSquadBoards, useWatchList } from '../coach/coachMatches';
import { counted } from '../../scoreboard/form';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { lastPlayedOf, loadDays, restBefore, restLabel } from '../coach/load';
import { LoadStrip } from '../coach/LoadStrip';
import { useSquadFocus } from '../coach/mySquads';
import { NextOpponentCard } from '../coach/NextOpponentCard';
import { SquadGate } from '../coach/SquadSwitch';
import { WorldField } from '../WorldField';
import { ErrorNote } from '../../directory/DirectoryResults';
import { crestsOf, when, type FieldProps } from './fieldProps';
import { ScoreGroups } from '../../scoreboard/Scoreboard';

const soonest = (match?: HistoryMatch | null) => match?.startsAt ? Date.parse(match.startsAt) : Infinity;
/** Played matches: history also returns cancelled fixtures, which are no one's result. */
const played = (recent: HistoryMatch[]) => recent.filter(match => match.fixtureStatus !== 'CANCELLED' && hasStarted(match.startsAt));

/** Each squad's next match and what is known about the opponent: the first thing a coach looks at on Monday. */
export function NextOpponentField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useNextOpponents(focus);
    const crestOf = crestsOf(markers);
    const items = [...(data.data ?? [])].sort((a, b) => soonest(a.next) - soonest(b.next));
    const first = items[0]?.next ? items[0] : null;
    return (
        <WorldField id="nextOpponent" side={side} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={first ? `${first.squad.name} · ${when(first.next!.startsAt, first.next!.timezone)}` : undefined}
            all={focus.status === 'ready' ? { label: t('All your fixtures'), to: fixturesLink(focus, 'UPCOMING') } : undefined}>
            <SquadGate focus={focus}>
                {items.map(item => <NextOpponentCard key={item.squad.id} up={item} crestOf={crestOf}
                    emphasis={role === 'goalkeeper-coach' ? 'goals' : undefined} results={role === 'analyst' ? 5 : 3} />)}
            </SquadGate>
        </WorldField>
    );
}

/** The squads' last two results and next three matches, under each squad, as favourites on a score site. */
export function SquadFixturesField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const boards = useSquadBoards(focus);
    const crestOf = crestsOf(markers);
    const rows = (boards.data ?? []).flatMap(board => [...played(board.recent).slice(0, 2).reverse(), ...board.upcoming.slice(0, 3)].map(match => ({ match, squad: board.squad })));
    const owed = (boards.data ?? []).flatMap(board => played(board.recent).filter(match => !counted(match))).length;
    return (
        <WorldField id="squadFixtures" side={side} loading={focus.status === 'loading' || boards.loading} error={boards.error} onRetry={boards.retry}
            hint={owed ? t('{count} without a result', { count: owed }) : focus.status === 'ready' ? focus.focus.map(squad => squad.name).join(' · ') : undefined}
            all={focus.status === 'ready' ? { label: t('All fixtures and results'), to: fixturesLink(focus, 'UPCOMING') } : undefined}>
            <SquadGate focus={focus}>
                {rows.length ? <ScoreGroups label={t('Your squads’ matches')} items={rows} group={row => row.squad.name}>
                    {row => <HistoryLine key={`${row.squad.id}:${row.match.id}`} match={row.match} crestOf={crestOf} mine={team => team.squadId === row.squad.id}
                        tag={row.match.tournamentName || (row.match.source === 'MATCH_EXCHANGE' ? t('Friendly') : undefined)} />}
                </ScoreGroups> : <EmptyNote title={t('No matches on record for your squads')} />}
            </SquadGate>
        </WorldField>
    );
}

/** Two weeks of matches per squad, with short rest marked: who needs rotating, and when. */
export function MatchLoadField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const boards = useSquadBoards(focus);
    const crestOf = crestsOf(markers);
    // Rest counts from each squad's last match played, so the strip, its notes and the rows below agree.
    const squads = (boards.data ?? []).map(board => ({ board, lastPlayed: lastPlayedOf(board.recent) }));
    const rows = squads.map(({ board, lastPlayed }) => ({ name: board.squad.name, days: loadDays(board.upcoming, { lastPlayed }) }));
    const fortnight = new Set(rows.flatMap(row => row.days.flatMap(day => day.matches.map(match => match.id))));
    const coming = squads.flatMap(({ board, lastPlayed }) => { const rest = restBefore(board.upcoming, lastPlayed); return board.upcoming.filter(match => fortnight.has(match.id)).map(match => ({ match, squad: board.squad, rest: rest.get(match.id) })); });
    const total = rows.reduce((sum, row) => sum + row.days.reduce((days, day) => days + day.matches.length, 0), 0);
    const tight = rows.reduce((sum, row) => sum + row.days.filter(day => day.tight).length, 0);
    return (
        <WorldField id="matchLoad" side={side} loading={focus.status === 'loading' || boards.loading} error={boards.error} onRetry={boards.retry}
            hint={boards.data ? [t('{matches} in 14 days', { matches: plural(total, 'match', 'matches') }), tight ? t('{count} with short rest', { count: tight }) : ''].filter(Boolean).join(' · ') : undefined}
            all={focus.status === 'ready' ? { label: t('Open the calendar'), to: '/calendar' } : undefined}>
            <SquadGate focus={focus}>
                {total ? <>
                    <LoadStrip rows={rows} />
                    <ScoreGroups label={t('Matches over the next two weeks')} items={coming} group={row => row.squad.name}>
                        {row => <HistoryLine key={`${row.squad.id}:${row.match.id}`} match={row.match} crestOf={crestOf} mine={team => team.squadId === row.squad.id}
                            tag={row.rest && <span data-tone={row.rest.tight ? 'warning' : undefined}>{restLabel(row.rest.days, t)}</span>} />}
                    </ScoreGroups>
                </> : <EmptyNote title={t('No matches in the next two weeks')} />}
            </SquadGate>
        </WorldField>
    );
}

/** Where to watch the next opponents before they meet my squads. */
export function WatchOpponentsField({ side, role, markers }: FieldProps) {
    const t = useWorldCopy();
    const focus = useSquadFocus(role);
    const data = useWatchList(focus);
    const crestOf = crestsOf(markers);
    const rows = (data.data ?? []).flatMap(entry => entry.matches.map(match => ({ match, entry })));
    const failed = (data.data ?? []).some(entry => entry.failed);
    return (
        <WorldField id="watchOpponents" side={side} count={data.data ? rows.length : null} loading={focus.status === 'loading' || data.loading} error={data.error} onRetry={data.retry}
            hint={data.data?.length ? data.data.map(entry => entry.opponent.club).filter(Boolean).slice(0, 2).join(' · ') : undefined}>
            <SquadGate focus={focus}>
                {failed && <ErrorNote message={t('Some opponents’ fixtures could not load.')} onRetry={data.retry} />}
                {rows.length ? <ScoreGroups label={t('Watch them before you play')} items={rows}
                    group={row => t('{opponent}, before {day}', { opponent: row.entry.opponent.name, day: fixtureDay(row.entry.before.startsAt, row.entry.before.timezone) })}>
                    {row => <HistoryLine key={`${row.entry.before.id}:${row.match.id}`} match={row.match} crestOf={crestOf} tag={row.match.locationName?.split(',')[0]} />}
                </ScoreGroups> : failed ? null : <EmptyNote title={data.data?.length ? t('None of their other matches is on record before you meet') : t('Your squads have no opponents booked yet')} />}
            </SquadGate>
        </WorldField>
    );
}
