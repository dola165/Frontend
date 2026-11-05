import { useResultCopy } from '../matchHistory/copy';
import { formatDateTime } from '../../utils/formatting';
import type { ScoreHistory } from './api';
import { goals, partyName } from './status';

const actions: Record<ScoreHistory['action'], readonly [string, string]> = {
  REPORT: ['Reported', 'შეიტანა'], CONFIRM: ['Confirmed', 'დაადასტურა'], DISPUTE: ['Disputed with', 'გაასაჩივრა ანგარიშით'],
  SETTLE: ['Settled at', 'გადაწყვიტა'], FINALIZE: ['Became final', 'გახდა საბოლოო'], IMPORTED: ['Recorded before GrassKickZ', 'შეტანილია GrassKickZ-მდე'],
  PROPOSE: ['Proposed', 'შესთავაზა'], CORRECT: ['Corrected to', 'შეასწორა'],
};

/** Who reported, confirmed, disputed or settled, when and why: newest first, under a small disclosure. */
export function ScoreHistoryList({ history, home, away }: { history: ScoreHistory[]; home: string; away: string }) {
  const { copy } = useResultCopy();
  return <details className="gk-score__history">
    <summary>{copy('History', 'ისტორია')} <span className="gk-score__count">{history.length}</span></summary>
    <ol>{history.map(row => {
      // A confirmation or the 48-hour finality repeats the score it kept; the rest carry their own.
      const score = row.action === 'CONFIRM' || row.action === 'FINALIZE' ? null : goals(row.homeScore, row.awayScore);
      const by = row.actorName ? `${row.actorName}${row.side ? ` · ${partyName(row.side, home, away, copy)}` : ''}` : row.side ? partyName(row.side, home, away, copy) : null;
      return <li key={row.id}>
        <span className="gk-score__history-what"><strong>{copy(...actions[row.action])}</strong>{score && <span className="gk-num"> {score}</span>}</span>
        <span className="gk-score__history-who">{[by, formatDateTime(row.createdAt)].filter(Boolean).join(' · ')}</span>
        {row.reason && <q className="gk-score__history-why">{row.reason}</q>}
      </li>;
    })}</ol>
  </details>;
}
