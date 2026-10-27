import { Navigate, useLocation, useParams } from 'react-router-dom';

export function LegacyCleanupRedirect({ kind }: { kind: 'connections' | 'notifications' | 'squads' }) {
    const location = useLocation();
    const { id } = useParams();
    const params = new URLSearchParams(location.search);
    let pathname = '/requests';
    if (kind === 'notifications') params.set('view', 'updates');
    else if (kind === 'squads') { pathname = `/clubs/${id}`; params.set('tab', 'teams'); }
    else if (params.has('permissionId')) { pathname = '/parent'; params.set('tab', 'connections'); }
    return <Navigate replace to={{ pathname, search: params.toString() ? `?${params}` : '', hash: location.hash }} state={location.state} />;
}
