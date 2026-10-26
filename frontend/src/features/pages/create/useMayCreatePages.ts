import { useAuth } from '../../../context/AuthContext';
import { isKnownMinor } from '../../../utils/age';

/**
 * Whether to offer page creation: pages are for adults, so it is hidden from someone known to be under 18. Without a
 * birth date it is offered, and the create sheet asks for the date first.
 */
export const useMayCreatePages = () => !isKnownMinor(useAuth().user?.dob);
