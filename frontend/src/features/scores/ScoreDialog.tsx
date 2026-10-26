import { Dialog } from '../../design/Dialog';
import { useResultCopy } from '../matchHistory/copy';
import type { ScoreTarget } from './api';
import { ExchangeScore } from './ExchangeScore';
import type { ScoreTeams } from './MatchScore';
import { ScoreBlock } from './ScoreBlock';

/**
 * "Report score" from any list of finished matches (My squads, a squad's matches): the match's score card in a small
 * dialog, the same for a Match Exchange match and a club-calendar one. Without its teams, a Match Exchange match reads
 * them from the match.
 */
export function ScoreDialog({ target, teams, title, description, onClose, onChanged }: {
  target: ScoreTarget; teams?: ScoreTeams; title: string; description?: string; onClose: () => void; onChanged: () => void;
}) {
  const { copy } = useResultCopy();
  return <Dialog open size="sm" title={copy('Score', 'ანგარიში')} description={description ?? title} onClose={onClose} closeLabel={copy('Close', 'დახურვა')}>
    {teams
      ? <ScoreBlock target={target} {...teams} title={false} onChanged={onChanged} />
      : target.kind === 'EXCHANGE'
        ? <ExchangeScore eventId={target.eventId} title={false} onChanged={onChanged} />
        : <ScoreBlock target={target} home={{ name: copy('Home team', 'მასპინძელი გუნდი') }} away={{ name: copy('Opponent', 'მეტოქე') }} title={false} onChanged={onChanged} />}
  </Dialog>;
}
