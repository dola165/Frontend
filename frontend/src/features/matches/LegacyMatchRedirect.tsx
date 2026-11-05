import { Navigate, useLocation, useParams } from 'react-router-dom';

/**
 * Old match links (`/match-exchange/{id}`, from notifications, emails, chat messages and pins made before step 6)
 * land on the one match page, keeping their query (a reservation sheet, a context) and their anchor (#result,
 * #appointment-N, #coordination). The page then opens in the viewer's own context.
 */
export function LegacyMatchRedirect() {
    const { eventId } = useParams();
    const { search, hash } = useLocation();
    return /^\d+$/.test(eventId ?? '') ? <Navigate to={`/matches/${eventId}${search}${hash}`} replace /> : <Navigate to="/world/matches" replace />;
}
