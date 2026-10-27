import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface ClubSummary { crest: string | null; following: boolean | undefined }

// One request per club for the page's lifetime; a missing crest falls back to the club's initials.
const clubs = new Map<number, Promise<ClubSummary>>();
const summaryOf = (clubId: number) => {
    if (!clubs.has(clubId)) clubs.set(clubId, apiClient.get<{ logoUrl?: string | null; isFollowedByMe?: boolean }>(`/clubs/${clubId}`)
        .then(r => ({ crest: resolveMediaUrl(r.data.logoUrl) || null, following: typeof r.data.isFollowedByMe === 'boolean' ? r.data.isFollowedByMe : undefined }))
        .catch(() => ({ crest: null, following: undefined })));
    return clubs.get(clubId)!;
};

function useClubSummary(clubId: number | undefined) {
    const [summary, setSummary] = useState<{ clubId: number } & ClubSummary | null>(null);
    useEffect(() => {
        if (!clubId) return;
        let active = true;
        void summaryOf(clubId).then(found => { if (active) setSummary({ clubId, ...found }); });
        return () => { active = false; };
    }, [clubId]);
    return summary && summary.clubId === clubId ? summary : null;
}

/** The club's crest for squad pages and the parent's child rows. */
export const useClubCrest = (clubId: number | undefined) => useClubSummary(clubId)?.crest ?? null;

/** Whether the person follows the club (undefined while unknown), and the change Follow makes, kept for the page's lifetime. */
export function useClubFollowing(clubId: number | undefined): [boolean | undefined, (following: boolean) => void] {
    const summary = useClubSummary(clubId);
    const [changed, setChanged] = useState<{ clubId: number; following: boolean } | null>(null);
    const following = changed && changed.clubId === clubId ? changed.following : summary?.following;
    return [following, next => {
        if (!clubId) return;
        setChanged({ clubId, following: next });
        void summaryOf(clubId).then(found => clubs.set(clubId, Promise.resolve({ ...found, following: next })));
    }];
}
