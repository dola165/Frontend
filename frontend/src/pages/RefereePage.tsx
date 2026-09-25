import { Navigate, useParams } from 'react-router-dom';
import { RefereeWorkspace } from '../features/refereeWorkspace/RefereeWorkspace';
export { ProfileEditor, CareerForm, CareerTimeline, MatchHistory } from '../features/refereeWorkspace/ProfileTools';
export function RefereePage() {
  const { refereeId } = useParams();
  return refereeId === 'me' ? <RefereeWorkspace/> : <Navigate to={`/profile/${refereeId}`} replace/>;
}
