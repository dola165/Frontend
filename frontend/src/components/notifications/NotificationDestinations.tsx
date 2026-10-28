import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationTarget } from './NotificationTarget';
import { BookingNotificationTarget } from './BookingNotificationTarget';
import { SquadConversationNotificationTarget } from './SquadConversationNotificationTarget';

/** Old notification addresses and the Inbox use the same permission-checked targets. */
export function NotificationDestinations() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    return <>
                {searchParams.has('squadId') && <SquadConversationNotificationTarget key={user?.id} squadId={searchParams.get('squadId') ?? ''} channel={searchParams.get('channel') ?? ''} thread={searchParams.get('thread')} onClose={() => {
                    const next = new URLSearchParams(searchParams); next.delete('squadId'); next.delete('channel'); next.delete('thread'); setSearchParams(next);
                }} />}
                {(searchParams.has('bookingId') || searchParams.has('venueId')) && <BookingNotificationTarget key={user?.id} venueId={searchParams.get('venueId') ?? ''} bookingId={searchParams.get('bookingId') ?? ''} onClose={() => {
                    const next = new URLSearchParams(searchParams); next.delete('venueId'); next.delete('bookingId'); setSearchParams(next);
                }} />}
                {searchParams.has('itemId') && <NotificationTarget kind="outcome" id={searchParams.get('itemId') ?? ''} onClose={() => {
                    const next = new URLSearchParams(searchParams); next.delete('itemId'); setSearchParams(next);
                }} />}
    </>;
}
