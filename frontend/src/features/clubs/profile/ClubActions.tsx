import { Check, LayoutGrid, MessageSquare, Plus, Settings, Swords, UserPlus } from 'lucide-react';
import { Button, ButtonLink } from '../../../design/primitives';
import type { ClubPermissions } from './useClubProfile';
import type { ClubProfile } from './types';

/** Where a club's staff arrange a match against this club. The form lives in World. */
export const proposeMatchPath = (clubId: number) => `/world/matches/arrange?opponent=${clubId}`;

/**
 * The header actions, chosen from the viewer's verified relationship: staff open the workspace,
 * another club's staff propose a match, and everyone else can follow or join. One primary action.
 */
export function ClubActions({ club, can, onFollow, onJoin, onMessage, onSettings }: {
    club: ClubProfile; can: ClubPermissions;
    onFollow: () => void; onJoin: () => void; onMessage: () => void; onSettings: () => void;
}) {
    const following = club.isFollowedByMe;
    if (can.canOpenWorkspace) return <>
        {can.isLeader && <Button id="club-settings-trigger" onClick={onSettings}><Settings aria-hidden="true" />Club settings</Button>}
        <ButtonLink variant="primary" to={`/clubs/${club.id}/workspace`}><LayoutGrid aria-hidden="true" />{can.invitationOnly ? 'Review invitation' : 'Open workspace'}</ButtonLink>
    </>;
    const primary: 'match' | 'join' | 'follow' | null = can.canChallenge ? 'match' : can.canJoin ? 'join' : can.canFollow && !following ? 'follow' : null;
    return <>
        {can.canFollow && <Button variant={primary === 'follow' ? 'primary' : 'secondary'} aria-pressed={following} onClick={onFollow}>
            {following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{following ? 'Following' : 'Follow'}
        </Button>}
        {can.canMessage && <Button onClick={onMessage}><MessageSquare aria-hidden="true" />Message</Button>}
        {can.canJoin && !can.canChallenge && <Button variant={primary === 'join' ? 'primary' : 'secondary'} onClick={onJoin}><UserPlus aria-hidden="true" />Join</Button>}
        {can.canChallenge && <ButtonLink variant="primary" to={proposeMatchPath(club.id)}><Swords aria-hidden="true" />Propose a match</ButtonLink>}
    </>;
}
