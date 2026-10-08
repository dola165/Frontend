import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../api/axiosConfig';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { OrganizationActivitySettings } from '../activities/OrganizationActivitySettings';
import { OrganizationPortfolio } from '../OrganizationPortfolio';
import { WorkspaceImports } from './WorkspaceImports';
import './setup.css';
import '../presentation/entity-profile.css';

export function ClubOrganizationTools({ clubId }: { clubId: number }) {
  const { sessionId } = useAuth();
  return <ClubToolsContent key={`${clubId}:${sessionId}`} clubId={clubId} />;
}
function ClubToolsContent({ clubId }: { clubId: number }) {
  const { refreshNavigationCapabilities } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [workspace, setWorkspace] = useState<{ id: number; clubId: number | null; canManage: boolean; promotionBlocked: boolean } | null>(null);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const section = ['imports', 'facilities'].includes(search.get('section') ?? '') ? search.get('section') : 'activities';
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const { data } = await apiClient.get<{ id: number; clubId: number | null }[]>('/organizations/workspaces', { signal: controller.signal });
      const organization = data.find(o => o.clubId === clubId);
      if (!organization) throw new Error('Club organization access is unavailable.');
      const response = await apiClient.get<{ id: number; clubId: number | null; canManage: boolean; promotionBlocked: boolean }>(`/organizations/${organization.id}/workspace`, { signal: controller.signal });
      if (!controller.signal.aborted && response.data.clubId === clubId) setWorkspace(response.data);
    })().catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load club activity settings.')); });
    return () => controller.abort();
  }, [clubId, attempt]);
  return <section className="club-organization-tools"><h2>Club activities and imports</h2>{error && <p role="alert">{error} <button onClick={() => { setError(''); setAttempt(n => n + 1); }}>Retry</button></p>}{!workspace && !error && <p role="status">Loading club tools…</p>}{workspace && !workspace.canManage && <p>Current club leadership manages these settings.</p>}{workspace?.canManage && <><nav aria-label="Club setup tools">{[['activities', 'Activities'], ['facilities', 'Venue relationships'], ['imports', 'Import Excel or CSV']].map(([key, label]) => <button type="button" key={key} aria-current={section === key ? 'page' : undefined} onClick={() => { const next = new URLSearchParams(search); next.set('section', key); setSearch(next); }}>{label}</button>)}</nav>
    {section === 'imports' ? <WorkspaceImports key={`${workspace.id}:imports`} id={workspace.id} clubId={clubId} blocked={workspace.promotionBlocked} /> : section === 'facilities' ? <OrganizationPortfolio id={workspace.id} /> : <OrganizationActivitySettings id={workspace.id} onChanged={() => { void refreshNavigationCapabilities().catch(() => undefined); }} />}
  </>}</section>;
}

/** Keeps the deployed club settings implementation intact when packaging a focused release. */
export function ClubSettingsWithOrganizationTools({ clubId, children }: { clubId: number; children: ReactNode }) {
  return <><ClubOrganizationTools clubId={clubId} />{children}</>;
}
