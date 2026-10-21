import { useAuth } from '../context/AuthContext';
import type { AuthSessionId } from '../utils/authStorage';
import { ParentHub } from '../features/parents/hub/ParentHub';

interface ParentHubPageProps { previewSessionId?: AuthSessionId }
export function ParentHubPage(props: ParentHubPageProps = {}) {
    if ('previewSessionId' in props) return import.meta.env.DEV ? <ParentHub sessionId={props.previewSessionId ?? null} /> : null;
    return <AuthenticatedParentHub />;
}
function AuthenticatedParentHub() {
    const { user, sessionId, isAuthenticated } = useAuth();
    return isAuthenticated ? <ParentHub key={`${user?.id}:${sessionId}`} sessionId={sessionId} /> : null;
}
