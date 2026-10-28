import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { legacyWorkspaceTarget } from '../features/clubOffice/officeLinks';

/**
 * The club workspace became Club office (step 2, 28 October 2026). Its old addresses, from notifications already
 * sent, saved pins and bookmarks, land on the matching place, tool or record.
 */
export default function ClubWorkspaceRedirect() {
    const { id } = useParams();
    const { search, hash } = useLocation();
    const { user } = useAuth();
    const club = Number(id);
    if (!Number.isSafeInteger(club) || club <= 0) return <Navigate replace to="/home" />;
    return <Navigate replace to={`${legacyWorkspaceTarget(club, new URLSearchParams(search), user?.navigationCapabilities)}${hash}`} />;
}
