import { useLocation } from 'react-router-dom';
import type { AuthUser } from '../../../context/AuthContext';
import type { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';

export const personName = (user: AuthUser, copy: ReturnType<typeof useJourneyCopy>) => user.fullName || user.name || user.username || copy('Your profile', 'თქვენი პროფილი');

/** The person's own places (profile, schedule, settings) have no tab; the avatar shows that you are in one. */
export function useInOwnPlace(userId: number) {
    const { pathname } = useLocation();
    return pathname === `/profile/${userId}` || pathname === '/account' || pathname.startsWith('/account/');
}
