import { useAuth } from '../context/AuthContext';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { isMinor } from '../utils/age';

/**
 * Only adults (18 or older) add a child or become a guardian (26 October 2026). Doors to it hide or refuse with this
 * reason; the server refuses on its own too. A missing birth date counts as under 18, as the server's minor policy does.
 * Someone signed out is not refused here: signing in comes first.
 */
export function useCanBeGuardian() {
    const { user } = useAuth();
    const copy = useJourneyCopy();
    const allowed = !user || !isMinor(user.dob);
    return {
        allowed,
        reason: allowed ? null : user?.dob
            ? copy('Only a parent or guardian who is 18 or older can add a child.', 'ბავშვის დამატება მხოლოდ 18 წლის ან უფროს მშობელს ან მეურვეს შეუძლია.')
            : copy('Add your date of birth in your account first: only adults can add a child.', 'ჯერ ანგარიშში მიუთითეთ დაბადების თარიღი: ბავშვის დამატება მხოლოდ სრულწლოვანს შეუძლია.'),
    };
}
