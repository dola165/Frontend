import { Navigate, useParams } from 'react-router-dom';

/** All public football identities share the same profile and privacy rules. */
export const AgentProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    return <Navigate to={`/profile/${id}?tab=career`} replace />;
};
