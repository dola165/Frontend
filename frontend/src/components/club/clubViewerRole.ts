/** A membership in another club must never supply this profile's role or controls. */
export const clubViewerRole = (viewedClubId: number, profileRole: string | null | undefined, membershipClubId: number | null, membershipRole: string | null): string | null =>
    profileRole ?? (viewedClubId === membershipClubId ? membershipRole : null);
