import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useResultCopy } from '../matchHistory/copy';
import type { ScoreRecord } from './api';
import type { Team } from './ScoreInputs';

/**
 * Why only the two clubs see this score, for their staff (the server sends the reason to nobody else): an under-11
 * match, or a squad whose age group is not set, with a link to set it, which publishes the score at once.
 */
export function ScorePrivacyNote({ record, home, away }: { record: ScoreRecord; home: Team; away: Team }) {
  const { copy } = useResultCopy();
  if (record.hiddenReason === 'UNDER_ELEVEN') return <p className="gk-score__private"><Lock aria-hidden="true" />
    {copy('Under-11 results are private to the two clubs and their families.', '11 წლამდელთა შედეგები მხოლოდ ორი კლუბისა და მათი ოჯახებისთვისაა ხილული.')}</p>;
  if (record.hiddenReason !== 'AGE_UNKNOWN') return null;
  // The squads named are the viewer's own, so their club is the side the viewer holds.
  const clubId = record.permissions.parties.includes('HOME') ? home.clubId : record.permissions.parties.includes('AWAY') ? away.clubId : null;
  const squads = clubId ? record.ageUnknownSquadIds ?? [] : [];
  return <p className="gk-score__private"><Lock aria-hidden="true" />
    <span>{copy('Only your club sees this. Set the squad’s age group (U12, Seniors…) to publish results.', 'ამას მხოლოდ თქვენი კლუბი ხედავს. შედეგების გამოსაქვეყნებლად მიუთითეთ გუნდის ასაკობრივი ჯგუფი (U12, უფროსები…).')}
      {squads.map((squadId, index) => <Link key={squadId} to={`/clubs/${clubId}/office?tab=squads&squad=${squadId}&edit=1`}>
        {squads.length > 1 ? copy(`Set age group ${index + 1}`, `ასაკობრივი ჯგუფი ${index + 1}`) : copy('Set the age group', 'ასაკობრივი ჯგუფის მითითება')}</Link>)}</span></p>;
}
