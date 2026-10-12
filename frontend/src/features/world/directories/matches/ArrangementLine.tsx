import { useWorldCopy } from '../../copy';
import { useMapCounterpart } from '../../directory/selection';
import { fixtureDay, fixtureTime } from '../../format';
import { peekOf } from '../../peek/usePeek';
import { MatchLine, WaitTag } from '../../scoreboard/Scoreboard';
import { Track } from '../../scoreboard/Track';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import type { Arrangement } from './arrangements';
import { opponentOf } from './matchBrowse';

/**
 * One of my arrangements as a score line: both sides (my side starred; an opponent still to find as an empty crest),
 * the score once a played match's result is agreed, and what it waits for (Needs you, Waiting on them) or its track
 * of four dots (Coming up, Played).
 */
export function ArrangementLine({ item: a }: { item: Arrangement }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const linked = useMapCounterpart();
    const { m } = a;
    const cancelled = m.event_status === 'CANCELLED' || m.listing_status === 'CANCELLED';
    const scored = a.lane === 'played' && m.result_status === 'CONFIRMED' && m.home_score != null && m.away_score != null;
    const away = m.opponent_name
        ? { name: opponentOf(m), logo: crestOf(m.opponent_club_id), score: scored ? m.away_score : null, mine: a.mine.away }
        : { name: opponentOf(m), muted: true };
    return (
        <MatchLine to={`/match-exchange/${m.event_id}`} peek={peekOf('match', a.code)} linked={linked} title={[m.title, m.location_name].filter(Boolean).join(' · ')}
            {...(cancelled ? { state: { word: t('Canc.'), code: 'cancelled', tone: 'danger' as const } } : { time: fixtureTime(m.starts_at_iso, m.timezone) })}
            day={fixtureDay(m.starts_at_iso, m.timezone)}
            home={{ name: `${m.club_name} ${m.squad_name}`, logo: m.club_logo_url, score: scored ? m.home_score : null, mine: a.mine.home }} away={away}
            tag={a.wait ? <WaitTag tone={a.wait.tone}>{t(a.wait.word, a.wait.vars)}</WaitTag> : <Track dots={a.track} />} />
    );
}
