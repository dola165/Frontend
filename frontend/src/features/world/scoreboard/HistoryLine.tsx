import type { ReactNode } from 'react';
import type { HistoryMatch } from '../../matchHistory/api';
import { useWorldCopy } from '../copy';
import { fixtureDay, shortDate } from '../format';
import { endOf } from './form';
import { lineState } from './lineState';
import { matchPagePath } from './matchCode';
import { matchState, zonedMatch } from './matchState';
import { MatchLine, WaitTag, type Linked } from './Scoreboard';
import { useNow } from './useNow';

export type CrestOf = (clubId: number | null) => string | null | undefined;

/**
 * A match from match history as a score line, its state worked out honestly (`matchState`): the score only once it
 * counts, FT, Canc., On now by the schedule, TBC; my team starred; and what a played match still owes as a waiting
 * tag. With `peek`, a plain click opens its drawer.
 */
export function HistoryLine({ match: source, crestOf, mine, tag, peek, open, linked }: {
    match: HistoryMatch; crestOf: CrestOf; /** Which side is the viewer's. */ mine?: (side: ReturnType<typeof endOf>) => boolean; tag?: ReactNode;
    peek?: string; /** How it opens, when not as the list does. */ open?: (value: string, options?: { focus?: boolean }) => void; linked?: Linked;
}) {
    const t = useWorldCopy();
    const match = zonedMatch(source);
    const own = Boolean(mine && (mine(endOf(match, 'home')) || mine(endOf(match, 'away'))));
    const now = useNow();
    const state = matchState(match, now, own);
    const side = (end: 'home' | 'away') => {
        const team = endOf(match, end);
        return { name: [team.club, team.squad].filter(Boolean).join(' ') || t('To be decided'), logo: crestOf(team.clubId), score: state.score?.[end] ?? null, mine: mine?.(team), muted: !team.club };
    };
    // Something owed is a waiting item (a dot, the word, an arrow); "in 2 h" is just said.
    const owed = state.tag && (state.code === 'before' ? t(state.tag.word, state.tag.vars) : <WaitTag tone={state.tag.tone}>{t(state.tag.word, state.tag.vars)}</WaitTag>);
    return <MatchLine to={matchPagePath(match)} peek={peek} open={open} linked={linked} title={[match.title, match.locationName].filter(Boolean).join(' · ')} {...lineState(state, t)}
        day={state.code === 'ft' ? shortDate(match.startsAt) ?? undefined : fixtureDay(match.startsAt, match.timezone)}
        home={side('home')} away={side('away')} tag={owed || tag} faint={state.faint} />;
}
