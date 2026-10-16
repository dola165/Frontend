import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

// One request per club for the page's lifetime; a missing crest falls back to the club's initials.
const crests = new Map<number, Promise<string | null>>();
const crestOf = (clubId: number) => {
    if (!crests.has(clubId)) crests.set(clubId, apiClient.get<{ logoUrl?: string | null }>(`/clubs/${clubId}`).then(r => resolveMediaUrl(r.data.logoUrl) || null).catch(() => null));
    return crests.get(clubId)!;
};

/** The club's crest for squad pages and the parent's child rows. */
export function useClubCrest(clubId: number | undefined) {
    const [crest, setCrest] = useState<{ clubId: number; url: string | null } | null>(null);
    useEffect(() => {
        if (!clubId) return;
        let active = true;
        void crestOf(clubId).then(url => { if (active) setCrest({ clubId, url }); });
        return () => { active = false; };
    }, [clubId]);
    return crest && crest.clubId === clubId ? crest.url : null;
}
