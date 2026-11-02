import { useSyncExternalStore } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyNote, GkRoot, PageFrame } from '../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../utils/authStorage';
import { ClubJobWorkspace } from '../features/clubWorkspaces/ClubJobWorkspace';
import { positiveId } from '../features/clubWorkspaces/api';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';

/** MAIN wires /clubs/:id/work and /clubs/:id/work/:workspace. Identity changes retire the entire desk and its editors. */
export default function ClubJobWorkspacePage() {
    const copy = useJourneyCopy();
    const { id, workspace } = useParams<{ id: string; workspace: string }>();
    const { isAuthenticated, sessionId, user } = useAuth();
    const currentSession = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    if (!isAuthenticated || !user || sessionId !== currentSession) return null;
    const club = Number(id);
    if (!id || !/^[1-9]\d*$/.test(id) || !positiveId(club)) return <GkRoot><PageFrame><EmptyNote title={copy('Choose a valid club workspace', 'აირჩიეთ სწორი კლუბის სამუშაო სივრცე')} /></PageFrame></GkRoot>;
    return <ClubJobWorkspace key={`${sessionId}:${user.id}:${club}`} clubId={club} actorId={user.id} sessionId={sessionId} workspaceKey={workspace} />;
}
