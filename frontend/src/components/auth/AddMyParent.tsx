import { useAuth } from '../../context/AuthContext';
import { FamilyLinkShare } from '../../features/parents/FamilyLinkShare';
import { addMyParentLink } from '../../features/parents/familyLinks';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';

/**
 * "Add my parent" (owner, 2 November 2026): a teen sends one link in any chat. When the parent opens it they are the
 * teen's parent on GrassKickZ, and for a waiting 13 to 15-year-old that is also the yes to the account. No parent's
 * email is asked for.
 */
export function AddMyParent({ waiting }: { waiting: boolean }) {
    const copy = useJourneyCopy();
    const { user } = useAuth();
    const first = (user?.fullName ?? '').trim().split(/\s+/)[0] || copy('your child', 'თქვენი შვილი');
    return <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--color-secondary)]">{waiting
            ? copy('Send this link to your mum, dad or guardian. When they open it, your account is ready.', 'გაუგზავნეთ ეს ბმული დედას, მამას ან მეურვეს. როცა გახსნიან, თქვენი ანგარიში მზად იქნება.')
            : copy('Send this link to your mum, dad or guardian, so they can say yes when your club asks.', 'გაუგზავნეთ ეს ბმული დედას, მამას ან მეურვეს, რომ თქვენი კლუბის თხოვნაზე თანხმობა მისცენ.')}</p>
        <FamilyLinkShare load={addMyParentLink}
            title={copy(`${first} on GrassKickZ`, `${first} GrassKickZ-ზე`)}
            subtitle={copy('Open it to be their parent here', 'გახსენით, რომ აქ მისი მშობელი იყოთ')}
            message={copy(`Hi! Can you open this so you're my parent on GrassKickZ?`, 'გამარჯობა! გახსნი ამას, რომ GrassKickZ-ზე ჩემი მშობელი იყო?')}
            label={copy('Your link for your parent', 'ბმული თქვენი მშობლისთვის')} />
    </div>;
}
