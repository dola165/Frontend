import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchPlayerIdentity } from '../../features/joining-contract/api';
import { PlayerIdentityEditor } from '../../features/players/PlayerIdentityEditor';
import { playerPositionLabel } from '../../features/players/playerIdentityLabels';
import { useAdmissionData } from '../../features/admissions/applicant/useAdmissionData';
import { AdmissionError, AdmissionLoading } from '../../features/admissions/applicant/AdmissionFrame';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { MediaImage } from '../ui/MediaImage';

type Props = { playerId: number; onSaved: () => void };
export function RosterPlayerIdentity(props: Props) {
  const { sessionId } = useAuth();
  return <IdentitySummary key={`${sessionId}:${props.playerId}`} {...props} />;
}

function IdentitySummary({ playerId, onSaved }: Props) {
  const { sessionId } = useAuth(), copy = useJourneyCopy();
  const [editing, setEditing] = useState(false);
  const data = useAdmissionData(useCallback(signal => fetchPlayerIdentity(playerId, sessionId, signal), [playerId, sessionId]), sessionId);
  if (data.loading) return <AdmissionLoading />;
  if (data.error) return <AdmissionError message={data.error} retry={data.refresh} />;
  const identity = data.data;
  if (!identity) return null;
  if (editing && identity.canEdit) return <PlayerIdentityEditor playerId={playerId} onSaved={onSaved} onCancel={() => setEditing(false)} />;
  const unset = copy('Not provided', 'არ არის მითითებული');
  const foot = identity.dominantFoot === 'LEFT' ? copy('Left', 'მარცხენა') : identity.dominantFoot === 'RIGHT' ? copy('Right', 'მარჯვენა') : identity.dominantFoot === 'BOTH' ? copy('Both', 'ორივე') : unset;
  return <div className="prf-identity-summary">
    {identity.photoUrl && <MediaImage src={resolveMediaUrl(identity.photoUrl) || undefined} alt={copy('Player photo', 'მოთამაშის ფოტო')} />}
    <dl>
      <div><dt>{copy('Full name', 'სრული სახელი')}</dt><dd>{identity.fullName}</dd></div>
      <div><dt>{copy('Date of birth', 'დაბადების თარიღი')}</dt><dd>{identity.dateOfBirth || unset}</dd></div>
      <div><dt>{copy('Declared gender', 'გაცხადებული სქესი')}</dt><dd>{identity.gender === 'MALE' ? copy('Male', 'მამრობითი') : identity.gender === 'FEMALE' ? copy('Female', 'მდედრობითი') : unset}</dd></div>
      <div><dt>{copy('Playing positions', 'სათამაშო პოზიციები')}</dt><dd>{identity.positions.length ? identity.positions.map(code => playerPositionLabel(code, copy)).join(', ') : unset}</dd></div>
      <div><dt>{copy('Dominant foot', 'წამყვანი ფეხი')}</dt><dd>{foot}</dd></div>
      <div><dt>{copy('Height', 'სიმაღლე')}</dt><dd>{identity.heightCm == null ? unset : `${identity.heightCm} cm`}</dd></div>
      <div><dt>{copy('Weight', 'წონა')}</dt><dd>{identity.weightKg == null ? unset : `${identity.weightKg} kg`}</dd></div>
    </dl>
    {identity.canEdit ? <button type="button" className="prf-button" onClick={() => setEditing(true)}>{copy('Update shared player details', 'საერთო მონაცემების განახლება')}</button> : <p className="prf-hint">{copy('The player or current guardian updates these shared details.', 'საერთო მონაცემებს მოთამაშე ან მოქმედი მეურვე ანახლებს.')}</p>}
  </div>;
}
