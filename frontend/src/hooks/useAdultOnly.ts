import { useAuth } from '../context/AuthContext';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { isMinor } from '../utils/age';

/**
 * Things only adults (18 or older) do (26 October 2026): add a child or become a guardian (`guardian`), and take a
 * club job, by a staff link or an invite (`job`). Doors to them hide or refuse with this reason; the server refuses on
 * its own too. A missing birth date counts as under 18, as the server's minor policy does. Someone signed out is not
 * refused here: signing in comes first.
 */
export function useAdultOnly(what: 'guardian' | 'job') {
    const { user } = useAuth();
    const copy = useJourneyCopy();
    const allowed = !user || !isMinor(user.dob);
    const reason = allowed ? null : !user?.dob
        ? copy('Add your date of birth in your account first: this is for adults only.', 'ჯერ ანგარიშში მიუთითეთ დაბადების თარიღი: ეს მხოლოდ სრულწლოვნებისთვისაა.')
        : what === 'guardian'
            ? copy('Only a parent or guardian who is 18 or older can add a child.', 'ბავშვის დამატება მხოლოდ 18 წლის ან უფროს მშობელს ან მეურვეს შეუძლია.')
            : copy('Club jobs are for adults (18+).', 'კლუბში სამუშაო მხოლოდ სრულწლოვნებისთვისაა (18+).');
    return { allowed, reason };
}
