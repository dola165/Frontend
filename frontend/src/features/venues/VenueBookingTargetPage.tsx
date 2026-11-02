import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookingNotificationTarget } from '../../components/notifications/BookingNotificationTarget';
import { useAuth } from '../../context/AuthContext';
import { ButtonLink, GkRoot, PageFrame } from '../../design/primitives';
import { notificationId } from '../../utils/notificationDestinations';

/** An existing reservation is readable independently of its public venue listing or bookable inventory. */
export function VenueBookingTargetPage({ venueId, bookingId }: { venueId: string; bookingId: string }) {
    const { user, isBootstrapping } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const squad = notificationId(params.get('squadId') ?? ''), session = notificationId(params.get('sessionId') ?? '');
    // Only a typed internal return destination; query input grants no permission to either resource.
    const returnTo = squad && session ? `/squads/${squad}?tab=sessions&sessionId=${session}` : '/requests?view=updates';
    const returnLabel = squad && session ? 'Back to squad event' : 'Back to updates';
    const back = <ButtonLink variant="ghost" to={returnTo}>{returnLabel}</ButtonLink>;
    return <GkRoot className="gk-page"><PageFrame width="profile">
        {isBootstrapping ? <>{back}<p role="status">Checking account access…</p></> : user
            ? <BookingNotificationTarget venueId={venueId} bookingId={bookingId} returnTo={returnTo} returnLabel={returnLabel} onClose={() => navigate(returnTo)}/>
            : <>{back}<p role="alert">Sign in to read this reservation. <ButtonLink to="/login">Sign in</ButtonLink></p></>}
    </PageFrame></GkRoot>;
}
