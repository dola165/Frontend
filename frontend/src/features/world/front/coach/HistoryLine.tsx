import type { ReactNode } from 'react';
import type { HistoryMatch } from '../../../matchHistory/api';
import { useWorldCopy } from '../../copy';
import { fixtureDay, fixtureTime, hasStarted, shortDate } from '../../format';
import { MatchLine, WaitTag } from '../fields/Scoreboard';
import { counted, endOf } from './form';

export type CrestOf = (clubId: number | null) => string | null | undefined;

/**
 * A match from match history as a score line: crests, the score once it counts (a proposed or disputed score is
 * not a result), my team starred, and what is still owed on a played match without a result.
 */
export function HistoryLine({ match, crestOf, mine, tag }: { match: HistoryMatch; crestOf: CrestOf; /** Which side is the viewer's. */ mine?: (side: ReturnType<typeof endOf>) => boolean; tag?: ReactNode }) {
    const t = useWorldCopy();
    const past = hasStarted(match.startsAt), scored = counted(match);
    const side = (end: 'home' | 'away') => {
        const team = endOf(match, end);
        return { name: [team.club, team.squad].filter(Boolean).join(' ') || t('To be decided'), logo: crestOf(team.clubId), score: scored ? team.score : null, mine: mine?.(team), muted: !team.club };
    };
    const owed = !past || scored || match.fixtureStatus === 'CANCELLED' ? undefined
        : match.resultStatus === 'DISPUTED' ? <WaitTag tone="danger">{t('Score disputed')}</WaitTag>
        : match.resultStatus === 'PROPOSED' ? <WaitTag tone="warning">{t('Score to confirm')}</WaitTag>
        : <WaitTag tone="warning">{t('No result yet')}</WaitTag>;
    return <MatchLine to={match.detailPath} title={[match.title, match.locationName].filter(Boolean).join(' · ')} state={scored ? 'FT' : undefined}
        time={fixtureTime(match.startsAt, match.timezone)} day={scored ? shortDate(match.startsAt) ?? undefined : fixtureDay(match.startsAt, match.timezone)}
        home={side('home')} away={side('away')} tag={owed ?? tag} />;
}
