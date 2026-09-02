const FULL_MAP_ACCOUNT_ROLES = new Set(['ADMIN', 'SYSTEM_ADMIN', 'ORGANIZER', 'AGENT', 'CLUB_ADMIN', 'COACH']);
const FULL_MAP_MEMBERSHIP_ROLES = new Set(['OWNER', 'CLUB_ADMIN', 'COACH']);

const normalizeRole = (role?: string | null) => role?.trim().toUpperCase() ?? '';

/**
 * Matches the server-side map visibility policy. Account roles are checked
 * first so a coach still gets the staff map if membership context is missing
 * or temporarily unavailable.
 */
export const hasFullMapAccess = (accountRole?: string | null, membershipRole?: string | null) =>
    FULL_MAP_ACCOUNT_ROLES.has(normalizeRole(accountRole))
    || FULL_MAP_MEMBERSHIP_ROLES.has(normalizeRole(membershipRole));
