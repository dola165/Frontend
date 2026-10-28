import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { legacyWorkspaceTarget } from '../features/clubOffice/officeLinks';
import { operationTab } from '../features/clubOperations/workspaceNavigation';

/** Older notification and challenge links named a club tool by its module: they open that tool in Club office. */
export default function ClubOperationsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const club = Number(id);
  if (!Number.isSafeInteger(club) || club <= 0) return <p>Club not found.</p>;
  const next = new URLSearchParams(params);
  next.set('tab', operationTab(params.get('module')));
  return <Navigate replace to={legacyWorkspaceTarget(club, next)} />;
}
