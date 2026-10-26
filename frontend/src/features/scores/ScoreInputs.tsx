import { Crest } from '../../design/visuals';
import { useResultCopy } from '../matchHistory/copy';
import type { GoalsDraft } from './goals';
import './scores.css';

export type Team = { name: string; logo?: string | null };

/** The score as two big boxes under the two crests, home first: the one way a score is typed anywhere in the app. */
export function ScoreInputs({ home, away, value, onChange, disabled, autoFocus }: {
  home: Team; away: Team; value: GoalsDraft; onChange: (value: GoalsDraft) => void; disabled?: boolean; autoFocus?: boolean;
}) {
  const { copy } = useResultCopy();
  const side = (key: 'home' | 'away', team: Team) => <label className="gk-score-pick__side">
    <span className="gk-score-pick__name"><Crest src={team.logo} name={team.name} size={28} /><strong title={team.name}>{team.name}</strong></span>
    <input className="gk-input gk-score-pick__input" inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="off" value={value[key]} disabled={disabled}
      aria-label={copy(`Goals for ${team.name}`, `${team.name} - გოლები`)} autoFocus={autoFocus && key === 'home'}
      onChange={event => onChange({ ...value, [key]: event.target.value.replace(/\D/g, '').slice(0, 2) })} />
  </label>;
  return <div className="gk-score-pick">{side('home', home)}<span className="gk-score-pick__dash" aria-hidden="true">–</span>{side('away', away)}</div>;
}
