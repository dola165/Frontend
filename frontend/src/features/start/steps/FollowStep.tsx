import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { followClub, unfollowClub } from '../startApi';
import type { WelcomeFacts } from '../useWelcomeFacts';
import { ClubCard } from './ClubCard';

/**
 * Clubs near the person, in their own country only, nearest first, each followed or unfollowed with one tap. A follow
 * that fails goes back and says so. The step is left out when no club near them is known.
 */
export function FollowStep({ facts }: { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const [busy, setBusy] = useState<Set<number>>(new Set());
    const [failed, setFailed] = useState(false);

    const toggle = async (id: number, on: boolean) => {
        setFailed(false);
        setBusy(current => new Set(current).add(id));
        facts.setFollowing(id, on);
        try { await (on ? followClub(id) : unfollowClub(id)); }
        catch { facts.setFollowing(id, !on); setFailed(true); }
        finally { setBusy(current => { const next = new Set(current); next.delete(id); return next; }); }
    };

    return <>
        <ul className="gk-welcome__cards" aria-label={copy('Clubs near you', 'კლუბები თქვენთან ახლოს')}>
            {(facts.clubs ?? []).map((club, index) => <ClubCard key={club.id} club={club} index={index} action={
                <Button variant={club.following ? 'secondary' : 'primary'} className="gk-welcome__follow" data-on={club.following || undefined}
                    aria-pressed={club.following} disabled={busy.has(club.id)} onClick={() => void toggle(club.id, !club.following)}>
                    {club.following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{club.following ? copy('Following', 'მიჰყვებით') : copy('Follow', 'მიყოლა')}
                </Button>} />)}
        </ul>
        {failed && <p role="alert" className="gk-notice gk-notice--warning">{copy('That follow did not go through. Try again.', 'მიყოლა ვერ მოხერხდა. სცადეთ ხელახლა.')}</p>}
    </>;
}
