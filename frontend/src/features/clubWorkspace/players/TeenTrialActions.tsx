import { useState } from 'react';
import { Send } from 'lucide-react';
import type { NotificationItem } from '../../../types/notifications';
import { Button } from '../../../design/primitives';
import { FamilyLinkShare } from '../../parents/FamilyLinkShare';
import { clubCardFamilyLink } from '../../parents/familyLinks';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

const clubIn = (path?: string | null) => Number(path?.match(/^\/clubs\/(\d+)\//)?.[1]) || null;

/**
 * A 13-17 player's own "Come to a trial": the coach can act in the notice itself, sending the player's card to the
 * family, since a trialist on no squad isn't on the coach's squad list yet. The notice's entity is the player.
 */
export function TeenTrialActions({ notification }: { notification: NotificationItem }) {
    const say = useJourneyCopy();
    const [sharing, setSharing] = useState(false);
    const club = clubIn(notification.linkPath), player = notification.entityId;
    if (notification.type !== 'CLUB_TEEN_TRIAL' || club == null || player == null) return null;
    return <div className="gk pp-notice-actions" onClick={event => event.stopPropagation()}>
        {sharing ? <FamilyLinkShare load={() => clubCardFamilyLink(club, player)} title={say('The player’s card', 'მოთამაშის ბარათი')} subtitle={say('Open it to be their parent here', 'გახსენით, რომ აქ მისი მშობელი იყოთ')}
            message={say('Here is the player’s card from our club. Open it to be their parent on GrassKickZ.', 'ეს არის მოთამაშის ბარათი ჩვენი კლუბიდან. გახსენით, რომ GrassKickZ-ზე მისი მშობელი იყოთ.')}
            label={say('Link for the family', 'ბმული ოჯახისთვის')} />
            : <Button size="sm" onClick={() => setSharing(true)}><Send aria-hidden="true" />{say('Send to the family', 'ოჯახისთვის გაგზავნა')}</Button>}
    </div>;
}
