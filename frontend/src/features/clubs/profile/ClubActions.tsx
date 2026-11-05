import { usePagesCopy } from '../../pages/copy';
import { LayoutGrid, MessageSquare, UserPlus } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { FollowButton } from '../../actions/FollowButton';
import { ActionButton } from '../../actions/ActionButton';
import type { ClubPermissions } from './useClubProfile';
import type { ClubProfile } from './types';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/**
 * The header actions, chosen from the viewer's verified relationship: staff open Club office and start matches
 * from here (club settings live in Club office), another club's staff arrange a match with it, and everyone else can follow or join. One primary action.
 */
export function ClubActions({ club, can, onFollowChange, onJoin, onMessage }: {
    club: ClubProfile; can: ClubPermissions;
    onFollowChange: (following: boolean) => void; onJoin: () => void; onMessage: () => void;
}) {
    const t = usePagesCopy();
    const copy = useJourneyCopy();
    const following = club.isFollowedByMe;
    if (can.canOpenWorkspace) return <>
        {can.canManage && <ActionButton action="arrange_match" subject={{ kind: 'club', id: club.id }} label={t('Arrange a match')} />}
        <ButtonLink variant="primary" to={can.invitationOnly ? '/requests' : `/clubs/${club.id}/office`}><LayoutGrid aria-hidden="true" />{t(can.invitationOnly ? 'Review invitation' : 'Club office')}</ButtonLink>
    </>;
    const primary: 'match' | 'join' | 'follow' | null = can.canChallenge ? 'match' : can.canJoin ? 'join' : can.canFollow && !following ? 'follow' : null;
    return <>
        {can.canFollow && <FollowButton subject={{ kind: 'club', id: club.id }} following={following} primary={primary === 'follow'} onChange={onFollowChange} />}
        {can.canMessage && <Button onClick={onMessage}><MessageSquare aria-hidden="true" />{t("Message")}</Button>}
        {can.canJoin && !can.canChallenge && <Button variant={primary === 'join' ? 'primary' : 'secondary'} onClick={onJoin}><UserPlus aria-hidden="true" />{copy('Join', 'შეუერთდით')}</Button>}
        {/* Inviting this club: the sheet still asks how, with the club filled in for an invitation. */}
        {can.canChallenge && <ActionButton action="arrange_match" variant="primary" hints={{ opponentId: club.id }} label={t('Arrange a match')} />}
    </>;
}
