import { useAuth } from '../context/AuthContext';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { isMinor } from '../utils/age';

/**
 * Things only adults (18 or older) do (26 October 2026): add a child or become a guardian (`guardian`), and take a
 * club job, by a staff link or an invite (`job`). Doors to them hide or refuse with this reason; the server refuses on
 * its own too. One meaning of adult across the app (`isMinor` in utils/age, shared with sign-up): a missing birth
 * date is not adult, and the door asks for it (`needsBirthDate`). Someone signed out is not refused here: signing in
 * comes first.
 */
export function useAdultOnly(what: 'guardian' | 'job') {
    const { user } = useAuth();
    const copy = useJourneyCopy();
    const allowed = !user || !isMinor(user.dob);
    const needsBirthDate = !allowed && !user?.dob;
    const reason = allowed ? null : needsBirthDate
        ? copy('This is for adults (18+). Add your date of birth first.', 'ეს მხოლოდ სრულწლოვნებისთვისაა (18+). ჯერ მიუთითეთ დაბადების თარიღი.')
        : what === 'guardian'
            ? copy('Only a parent or guardian who is 18 or older can add a child.', 'ბავშვის დამატება მხოლოდ 18 წლის ან უფროს მშობელს ან მეურვეს შეუძლია.')
            : copy('Club jobs are for adults (18+).', 'კლუბში სამუშაო მხოლოდ სრულწლოვნებისთვისაა (18+).');
    return { allowed, needsBirthDate, reason };
}
