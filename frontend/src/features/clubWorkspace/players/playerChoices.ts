import type { ClubPlayerAffiliation, PlayerAffiliationStatus } from '../../clubs/domain';

export interface PlayerRowActions {
    pendingKey: string | null;
    canManagePlayerStatuses: boolean;
    onPlayerStatusChange: (userId: number, status: PlayerAffiliationStatus, playerName?: string) => Promise<void>;
    onTrialEndsChange: (userId: number, trialEndsOn: string) => Promise<void>;
    onReviewJoining?: (userId: number) => void;
    onOpenAdmissions: () => void;
    onMessagePlayer?: (userId: number, playerName?: string) => void;
    onSendConsentEmail?: (userId: number, parentEmail?: string | null) => Promise<boolean> | void;
}

export const playerName = (player: ClubPlayerAffiliation) => player.fullName || player.username || `Player #${player.userId}`;
export const trialDay = (player: ClubPlayerAffiliation, now: number) => player.status === 'TRIALIST' && player.joinedAt ? Math.max(0, Math.floor((now - new Date(player.joinedAt).getTime()) / 86_400_000)) : null;

/** What can be done with a player from the list, worked out once for the row, its actions and its details. */
export function playerChoices(player: ClubPlayerAffiliation, actions: PlayerRowActions, admissionManaged: boolean) {
    const trialist = player.status === 'TRIALIST', current = player.status === 'ACTIVE' || trialist, consent = player.parentalConsentStatus;
    const consentToSend = current && Boolean(player.requiresParentalConsent) && (!consent || consent === 'NOT_REQUIRED') && Boolean(actions.onSendConsentEmail);
    const canResend = Boolean(player.parentEmail && current && actions.onSendConsentEmail) && (consent === 'PENDING' || consent === 'EXPIRED' || consent === 'DECLINED');
    const canChange = actions.canManagePlayerStatuses && !admissionManaged;
    const changes: PlayerAffiliationStatus[] = player.status === 'ACTIVE' && canChange ? ['TRIALIST', 'PAST', 'REMOVED'] : trialist && canChange ? ['REMOVED'] : [];
    return { trialist, consentToSend, canResend, changes, hasDetails: trialist || (!admissionManaged && (consentToSend || canResend)) || changes.length > 0 };
}
