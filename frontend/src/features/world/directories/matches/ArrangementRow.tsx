import { Status } from '../../../../design/DataTable';
import { useWorldCopy } from '../../copy';
import { MatchRow } from '../../directory/MatchRow';
import { fixtureDay, fixtureTime } from '../../format';
import { peekOf } from '../../peek/usePeek';
import { WaitTag } from '../../scoreboard/Scoreboard';
import { Track } from '../../scoreboard/Track';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import type { Arrangement } from './arrangements';
import { opponentOf } from './matchBrowse';

/**
 * One of my arrangements as a row: both sides (my side starred; an opponent still to find as an empty ring), when
 * and where, and at the end the score once a played match's result is agreed, else what it waits for (Needs you,
 * Waiting on them) or its track of four dots (Coming up, Played).
 */
export function ArrangementRow({ item: a }: { item: Arrangement }) {
    const t = useWorldCopy();
    const crestOf = useClubCrests();
    const { m } = a;
    const cancelled = m.event_status === 'CANCELLED' || m.listing_status === 'CANCELLED';
    const scored = a.lane === 'played' && m.result_status === 'CONFIRMED' && m.home_score != null && m.away_score != null;
    const away = m.opponent_name
        ? { name: opponentOf(m), logo: crestOf(m.opponent_club_id), score: scored ? m.away_score : null, mine: a.mine.away }
        : { name: opponentOf(m), muted: true };
    return (
        <MatchRow to={`/match-exchange/${m.event_id}`} peek={peekOf('match', a.code)} title={[m.title, m.location_name].filter(Boolean).join(' · ')}
            home={{ name: `${m.club_name} ${m.squad_name}`, logo: m.club_logo_url, score: scored ? m.home_score : null, mine: a.mine.home }} away={away}
            lines={[[fixtureTime(m.starts_at_iso, m.timezone), fixtureDay(m.starts_at_iso, m.timezone), m.title, m.location_name?.split(',')[0]].filter(Boolean).join(' · ')]}
            aside={cancelled ? <Status tone="danger">{t('Canc.')}</Status> : a.wait ? <WaitTag tone={a.wait.tone}>{t(a.wait.word, a.wait.vars)}</WaitTag> : <Track dots={a.track} />} />
    );
}
