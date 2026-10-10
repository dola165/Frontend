import { Navigate, useLocation } from 'react-router-dom';
import { calendarDestination } from './calendarDestination';

/** `/calendar` is an old address; it forwards to the schedule that now owns the link. */
export function CalendarRedirect() {
    const location = useLocation();
    return <Navigate replace to={calendarDestination(location.search)} />;
}
