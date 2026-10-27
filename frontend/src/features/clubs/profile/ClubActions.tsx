import { usePagesCopy } from '../../pages/copy';
import { LayoutGrid, Megaphone, MessageSquare, Swords, UserPlus } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import { FollowButton } from '../../actions/FollowButton';
import { ActionButton } from '../../actions/ActionButton';
import { openChallengePath, proposeMatchPath } from './clubTabs';
import type { ClubPermissions } from './useClubProfile';
import type { ClubProfile } from './types';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

/**
 * The header actions, chosen from the viewer's verified relationship: staff open the workspace and start matches
 * from here (club settings live in the workspace), another club's staff propose a match, and everyone else can follow or join. One primary action.
 */
export function ClubActions({ club, can, onFollowChange, onJoin, onMessage }: {
    club: ClubProfile; can: ClubPermissions;
    onFollowChange: (following: boolean) => void; onJoin: () => void; onMessage: () => void;
}) {
    const t = usePagesCopy();
    const copy = useJourneyCopy();
    const following = club.isFollowedByMe;
    if (can.canOpenWorkspace) return <>
        {can.canManage && <>
            <ButtonLink to={openChallengePath()}><Megaphone aria-hidden="true" />{t("Open challenge")}</ButtonLink>
            <ActionButton action="arrange_match" subject={{ kind: 'club', id: club.id }} label={t('Arrange a match')} />
        </>}
        <ButtonLink variant="primary" to={`/clubs/${club.id}/workspace`}><LayoutGrid aria-hidden="true" />{t(can.invitationOnly ? 'Review invitation' : 'Open workspace')}</ButtonLink>
    </>;
    const primary: 'match' | 'join' | 'follow' | null = can.canChallenge ? 'match' : can.canJoin ? 'join' : can.canFollow && !following ? 'follow' : null;
    return <>
        {can.canFollow && <FollowButton subject={{ kind: 'club', id: club.id }} following={following} primary={primary === 'follow'} onChange={onFollowChange} />}
        {can.canMessage && <Button onClick={onMessage}><MessageSquare aria-hidden="true" />{t("Message")}</Button>}
        {can.canJoin && !can.canChallenge && <Button variant={primary === 'join' ? 'primary' : 'secondary'} onClick={onJoin}><UserPlus aria-hidden="true" />{copy('Join', 'შეუერთდით')}</Button>}
        {can.canChallenge && <ButtonLink variant="primary" to={proposeMatchPath(club.id)}><Swords aria-hidden="true" />{t("Propose a match")}</ButtonLink>}
    </>;
}
