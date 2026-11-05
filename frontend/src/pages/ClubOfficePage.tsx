import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClubOffice } from '../features/clubOffice/ClubOffice';

/** Club office for one club. A new club or account starts afresh and never inherits another's state. */
export default function ClubOfficePage() {
    const { id } = useParams();
    const { isAuthenticated, sessionId } = useAuth();
    if (!isAuthenticated) return null;
    return <ClubOffice key={`${sessionId}:${id}`} clubId={Number(id)} sessionId={sessionId} />;
}
