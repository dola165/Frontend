import type { ClubPlayerAffiliation, PlayerAffiliationStatus } from '../../clubs/domain';
import type { ClaimedParent, FamilyLink } from '../../parents/familyLinks';

export interface PlayerRowActions {
    pendingKey: string | null;
    canManagePlayerStatuses: boolean;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onTrialEndsChange: (userId: number, trialEndsOn: string) => Promise<void>;
    onReviewJoining?: (userId: number) => void;
    onOpenAdmissions: () => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    /** "Send to the family": the card's family link for any chat (owner, 2 November 2026). */
    onFamilyLink?: (userId: number) => Promise<FamilyLink>;
    /** The card went to the family: the list reads the row again, which now says it is waiting. */
    onFamilySent?: () => void;
    /** Who claimed the card's family link, and "Not their parent". */
    onClaimedParents?: (userId: number, signal?: AbortSignal) => Promise<ClaimedParent[]>;
    onAnswerParentAsk?: (askId: number, yes: boolean) => Promise<void>;
    onChangeParentAskToYes?: (askId: number) => Promise<void>;
    onNotTheirParent?: (guardianLink: number) => Promise<void>;
}

export const playerName = (player: ClubPlayerAffiliation) => player.fullName || player.username || `Player #${player.userId}`;
export const trialDay = (player: ClubPlayerAffiliation, now: number) => player.status === 'TRIALIST' && player.joinedAt ? Math.max(0, Math.floor((now - new Date(player.joinedAt).getTime()) / 86_400_000)) : null;

/** What can be done with a player from the list, worked out once for the row, its actions and its details. */
export function playerChoices(player: ClubPlayerAffiliation, actions: PlayerRowActions, admissionManaged: boolean) {
    const trialist = player.status === 'TRIALIST', current = player.status === 'ACTIVE' || trialist, consent = player.parentalConsentStatus;
    // A child's card with no parent's yes yet goes to the family as a link; once confirmed there is nothing to send.
    const familyToReach = current && Boolean(player.requiresParentalConsent) && consent !== 'CONFIRMED' && Boolean(actions.onFamilyLink);
    const canChange = actions.canManagePlayerStatuses && !admissionManaged;
    const changes: PlayerAffiliationStatus[] = player.status === 'ACTIVE' && canChange ? ['TRIALIST', 'PAST', 'REMOVED'] : trialist && canChange ? ['REMOVED'] : [];
    return { trialist, familyToReach, changes, hasDetails: trialist || (!admissionManaged && familyToReach) || changes.length > 0 };
}
