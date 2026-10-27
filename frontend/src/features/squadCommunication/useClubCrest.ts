import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface ClubSummary { crest: string | null; following: boolean | undefined }

// One request per club and session for the page's lifetime (whether the person follows it is theirs alone, so a new
// session asks again); a missing crest falls back to the club's initials.
const clubs = new Map<string, Promise<ClubSummary>>();
const keyOf = (session: string | null | undefined, clubId: number) => `${session ?? 'guest'}:${clubId}`;
const summaryOf = (key: string, clubId: number) => {
    if (!clubs.has(key)) clubs.set(key, apiClient.get<{ logoUrl?: string | null; isFollowedByMe?: boolean }>(`/clubs/${clubId}`)
        .then(r => ({ crest: resolveMediaUrl(r.data.logoUrl) || null, following: typeof r.data.isFollowedByMe === 'boolean' ? r.data.isFollowedByMe : undefined }))
        .catch(() => ({ crest: null, following: undefined })));
    return clubs.get(key)!;
};

function useClubSummary(clubId: number | undefined) {
    const { sessionId } = useAuth();
    const key = clubId ? keyOf(sessionId, clubId) : null;
    const [summary, setSummary] = useState<{ key: string } & ClubSummary | null>(null);
    useEffect(() => {
        if (!key || !clubId) return;
        let active = true;
        void summaryOf(key, clubId).then(found => { if (active) setSummary({ key, ...found }); });
        return () => { active = false; };
    }, [key, clubId]);
    return summary && summary.key === key ? summary : null;
}

/** The club's crest for squad pages and the parent's child rows. */
export const useClubCrest = (clubId: number | undefined) => useClubSummary(clubId)?.crest ?? null;

/** Whether the person follows the club (undefined while unknown), and the change Follow makes, kept for the page's lifetime. */
export function useClubFollowing(clubId: number | undefined): [boolean | undefined, (following: boolean) => void] {
    const summary = useClubSummary(clubId);
    const [changed, setChanged] = useState<{ key: string; following: boolean } | null>(null);
    const following = summary && changed?.key === summary.key ? changed.following : summary?.following;
    return [following, next => {
        if (!summary || !clubId) return;
        setChanged({ key: summary.key, following: next });
        void summaryOf(summary.key, clubId).then(found => clubs.set(summary.key, Promise.resolve({ ...found, following: next })));
    }];
}
