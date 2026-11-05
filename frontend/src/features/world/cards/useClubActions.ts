import { useAuth } from '../../../context/AuthContext';
import type { ClubProfile, ClubRelationshipState } from '../../../components/discovery/clubDirectoryTypes';
import { useWorldChild } from '../players';
import { changeClub, useClubChange } from './clubState';

const RELATIONSHIP: Partial<Record<ClubRelationshipState, { label: string; tone: 'accent' | 'warning' | 'info' | 'violet' }>> = {
    ACTIVE: { label: 'Member', tone: 'accent' },
    APPLIED: { label: 'Application pending', tone: 'warning' },
    INVITED: { label: 'Invited', tone: 'info' },
    TRIALIST: { label: 'Trialist', tone: 'violet' },
};

/**
 * What World shows about the person and a club, wherever the club is shown (its row, its card beside the list): whether
 * they follow it and where they stand with it. World stays the same for everyone (the owner, 2 November 2026): joining,
 * asking about a place and arranging a match happen on the club's own page, never from a list. What the person does
 * here is shared with every other place the club is shown (`clubState`).
 */
export function useClubActions(club: ClubProfile) {
    const { sessionId } = useAuth();
    const { child } = useWorldChild();
    const key = `${sessionId}:${club.id}`;
    const changed = useClubChange(key);
    const following = changed?.following ?? club.isFollowedByMe;
    // Directory rows carry no relationship, only whether the person is a member.
    const relationship: ClubRelationshipState = changed?.relationship ?? club.relationshipState ?? (club.isMember ? 'ACTIVE' : 'NONE');

    /** Follow (`FollowButton`) changed, here and on every other card of the club. */
    const setFollowing = (next: boolean) => changeClub(key, { following: next });
    return {
        child, following, setFollowing,
        /** Where the person stands with the club; nothing for a club they have no tie to. */
        standing: RELATIONSHIP[relationship] ?? null,
        /** The academy and its pro club name each other: "Academy of FC Dinamo Tbilisi", "Academy: FC Dinamo Tbilisi Academy". */
        linked: club.presentation?.affiliations?.find(item => item.status === 'ACTIVE'),
    };
}
export type ClubActions = ReturnType<typeof useClubActions>;
