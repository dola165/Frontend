import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accessibleClubs } from '../components/layout/clubAccess';
import { SquadPage } from '../features/squadCommunication/page/SquadPage';

/** `/squads`: coaches have My squads; everyone else reaches their child's squads through Parent Hub. */
export function MySquadsPage() {
    const { user } = useAuth();
    return <Navigate replace to={accessibleClubs(user?.navigationCapabilities).some(club => club.canOpenWorkspace) ? '/my-squads' : '/parent'} />;
}

/** `/squads/:id`: the one squad page, for the coach and the parent alike. */
export function SquadCommunicationPage() {
    const { squadId } = useParams(), { sessionId } = useAuth();
    return squadId && /^\d+$/.test(squadId) ? <SquadPage key={`${sessionId}:${squadId}`} id={Number(squadId)} />
        : <main className="gk-page"><h1>Squad not found</h1><Link to="/parent">Parent Hub</Link></main>;
}
