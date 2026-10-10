import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { Button, EmptyNote, Panel, Skeleton } from '../../../design/primitives';
import { OrganizationActivitySettings } from '../../organizations/activities/OrganizationActivitySettings';
import { OrganizationPortfolio } from '../../organizations/OrganizationPortfolio';
import { WorkspaceImports } from '../../organizations/setup/WorkspaceImports';
import { LegacyIsland } from '../../clubOperations/records/LegacyIsland';
import '../../organizations/setup/setup.css';
import '../../organizations/presentation/entity-profile.css';
import '../club-workspace.css';

interface OrganizationWorkspace { id: number; clubId: number | null; canManage: boolean; promotionBlocked: boolean }

/** The club's organisation-level settings: which activities it offers, its venue relationships and data imports. */
export function ClubOrganizationSection({ clubId, section }: { clubId: number; section: 'activities' | 'facilities' | 'imports' }) {
    const { sessionId, refreshNavigationCapabilities } = useAuth();
    const [workspace, setWorkspace] = useState<OrganizationWorkspace | null>(null);
    const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            const { data } = await apiClient.get<{ id: number; clubId: number | null }[]>('/organizations/workspaces', { signal: controller.signal });
            const organization = data.find(o => o.clubId === clubId);
            if (!organization) throw new Error('Club organization access is unavailable.');
            const response = await apiClient.get<OrganizationWorkspace>(`/organizations/${organization.id}/workspace`, { signal: controller.signal });
            if (!controller.signal.aborted && response.data.clubId === clubId) setWorkspace(response.data);
        })().catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load club activity settings.')); });
        return () => controller.abort();
    }, [clubId, attempt, sessionId]);
    if (error) return <div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{error}</span><Button size="sm" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Try again</Button></div>;
    if (!workspace) return <Panel padded><Skeleton height={140} /></Panel>;
    if (!workspace.canManage) return <Panel><EmptyNote title="Current club leadership manages these settings" /></Panel>;
    return <Panel padded><LegacyIsland className="club-organization-tools">
        {section === 'imports' ? <WorkspaceImports key={`${workspace.id}:imports`} id={workspace.id} clubId={clubId} blocked={workspace.promotionBlocked} />
            : section === 'facilities' ? <OrganizationPortfolio id={workspace.id} />
                : <OrganizationActivitySettings id={workspace.id} onChanged={() => { void refreshNavigationCapabilities().catch(() => undefined); }} />}
    </LegacyIsland></Panel>;
}
