import { Dialog } from '../../design/Dialog';
import { useResultCopy } from '../matchHistory/copy';
import type { ScoreTarget } from './api';
import { ExchangeScore } from './ExchangeScore';
import type { ScoreTeams } from './MatchScore';
import { ScoreBlock } from './ScoreBlock';
import { ReportAsContext } from './reportAs';

/**
 * "Report score" from any list of finished matches (My squads, a squad's matches): the match's score card in a small
 * dialog, the same for a Match Exchange match and a club-calendar one. Without its teams, a Match Exchange match reads
 * them from the match. `reportAs` is the side the person reports for, when the opener knows it.
 */
export function ScoreDialog({ target, teams, title, description, reportAs = null, onClose, onChanged }: {
  target: ScoreTarget; teams?: ScoreTeams; title: string; description?: string; reportAs?: 'HOME' | 'AWAY' | 'REFEREE' | null; onClose: () => void; onChanged: () => void;
}) {
  const { copy } = useResultCopy();
  return <Dialog open size="sm" title={copy('Score', 'ანგარიში')} description={description ?? title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
    <ReportAsContext.Provider value={reportAs}>{teams
      ? <ScoreBlock target={target} {...teams} title={false} onChanged={onChanged} />
      : target.kind === 'EXCHANGE'
        ? <ExchangeScore eventId={target.eventId} title={false} onChanged={onChanged} />
        : <ScoreBlock target={target} home={{ name: copy('Home team', 'მასპინძელი გუნდი') }} away={{ name: copy('Opponent', 'მეტოქე') }} title={false} onChanged={onChanged} />}</ReportAsContext.Provider>
  </Dialog>;
}
