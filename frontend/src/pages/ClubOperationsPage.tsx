import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { operationTab } from '../features/clubOperations/workspaceNavigation';

/** Preserve existing notification and challenge links in the unified workspace. */
export default function ClubOperationsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const valid = Boolean(id && Number.isSafeInteger(Number(id)) && Number(id) > 0);
  const next = new URLSearchParams(params);
  next.set('tab', operationTab(params.get('module')));
  next.delete('module');
  const destination = `/clubs/${id}/workspace?${next}`;
  useEffect(() => { if (valid) navigate(destination, { replace: true }); }, [valid, destination, navigate]);
  return valid ? null : <p>Club not found.</p>;
}
