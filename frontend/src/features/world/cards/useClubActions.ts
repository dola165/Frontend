import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { createClubApplication, selfRegisterClubPlayer } from '../../clubs/api';
import type { ClubProfile, ClubRelationshipState } from '../../../components/discovery/clubDirectoryTypes';
import { toggleClubFollow } from '../api';
import { useWorldCopy } from '../copy';
import { JOIN_POLICY } from '../format';
import { COACHING_ROLES } from '../front/coach/mySquads';
import { useWorldRole } from '../front/useOverviewLayout';
import { useWorldChild } from '../players';
import { useWorldSession } from '../worldSession';
import { changeClub, useClubChange } from './clubState';
import { enquiryPath, fittingProgrammes } from './programmes';

const RELATIONSHIP: Partial<Record<ClubRelationshipState, { label: string; tone: 'accent' | 'warning' | 'info' | 'violet' }>> = {
    ACTIVE: { label: 'Member', tone: 'accent' },
    APPLIED: { label: 'Application pending', tone: 'warning' },
    INVITED: { label: 'Invited', tone: 'info' },
    TRIALIST: { label: 'Trialist', tone: 'violet' },
};

/**
 * What the person can do with a club, wherever the club is shown (its card, its row in a list): follow it, and the one
 * main action for who is looking. A parent asks the club about a place for their child through the club's enquiry;
 * joining in one click is offered only to someone joining for themselves who is verified to have no club; coaching
 * staff propose a match to another club (never their own). What the person does here is shared with every other place
 * the club is shown (`clubState`).
 */
export function useClubActions(club: ClubProfile) {
    const t = useWorldCopy();
    const { status, sessionId } = useAuth();
    const { membership } = useWorldSession();
    const { isParent, child } = useWorldChild();
    const role = useWorldRole();
    const navigate = useNavigate();
    const location = useLocation();
    const key = `${sessionId}:${club.id}`;
    const changed = useClubChange(key);
    const following = changed?.following ?? club.isFollowedByMe;
    // Directory rows carry no relationship, only whether the person is a member.
    const relationship: ClubRelationshipState = changed?.relationship ?? club.relationshipState ?? (club.isMember ? 'ACTIVE' : 'NONE');
    const [busy, setBusy] = useState<'follow' | 'join' | null>(null);
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
    const signIn = () => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
    const enquiry = isParent && (child || relationship === 'NONE') ? enquiryPath(club.id, child?.id, fittingProgrammes(club.presentation, child)[0]?.id) : null;
    const canJoin = !isParent && status === 'authenticated' && membership?.hasClubMembership === false && relationship === 'NONE'
        && (club.playerJoinPolicy === 'OPEN_TRIAL' || club.playerJoinPolicy === 'APPLICATION_REQUIRED');
    const ownClub = membership?.clubId != null && Number(membership.clubId) === club.id;
    // Only someone with a club (and so squads) can propose one; not to a club they already belong to or applied to.
    const propose = COACHING_ROLES.has(role) && status === 'authenticated' && membership?.hasClubMembership === true
        && !ownClub && relationship === 'NONE' && !enquiry && !canJoin;

    const follow = async () => {
        if (status !== 'authenticated') return signIn();
        setBusy('follow');
        changeClub(key, { following: !following });
        try { await toggleClubFollow(club.id); setMessage(null); }
        catch (error) { changeClub(key, { following }); setMessage({ text: extractApiErrorMessage(error, t('Following could not be updated.')), error: true }); }
        finally { setBusy(null); }
    };
    const join = async () => {
        setBusy('join');
        try {
            if (club.playerJoinPolicy === 'OPEN_TRIAL') { await selfRegisterClubPlayer(club.id); changeClub(key, { relationship: 'TRIALIST' }); setMessage({ text: t('You joined as a trialist.'), error: false }); }
            else { await createClubApplication(club.id, 'PLAYER', null); changeClub(key, { relationship: 'APPLIED' }); setMessage({ text: t('Application sent to the club.'), error: false }); }
        } catch (error) { setMessage({ text: extractApiErrorMessage(error, t('The club could not be contacted.')), error: true }); }
        finally { setBusy(null); }
    };
    return {
        child, following, follow, join, busy, message, enquiry, canJoin, propose,
        /** Where the person stands with the club, else how the club takes players. */
        standing: RELATIONSHIP[relationship] ?? (club.playerJoinPolicy ? JOIN_POLICY[club.playerJoinPolicy] : null),
        /** The academy and its pro club name each other: "Academy of FC Dinamo Tbilisi", "Academy: FC Dinamo Tbilisi Academy". */
        linked: club.presentation?.affiliations?.find(item => item.status === 'ACTIVE'),
    };
}
export type ClubActions = ReturnType<typeof useClubActions>;
