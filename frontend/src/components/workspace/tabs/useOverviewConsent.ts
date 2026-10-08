import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchClubPlayers } from '../../../features/clubs/api';
import type { ClubPlayerAffiliation } from '../../../features/clubs/domain';

interface ConsentOverview {
    clubId: number;
    players: ClubPlayerAffiliation[];
    reviewed: number;
    total: number;
}

// The player API has no consent filter. Preserve coverage so a bounded first
// screen never presents a partial review as a club-wide count.
export function useOverviewConsent(clubId: number, enabled: boolean, activeCount: number, trialistCount: number) {
    const [result, setResult] = useState<ConsentOverview | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(false);
    const requestRef = useRef(0);

    const retry = useCallback(async () => {
        const requestId = ++requestRef.current;
        if (!enabled) return;
        setLoading(true);
        setError(false);
        const emptyPage = { content: [] as ClubPlayerAffiliation[], totalElements: 0 };
        try {
            const pages = await Promise.all([
                activeCount > 0 ? fetchClubPlayers(clubId, 'ACTIVE', 0, 50) : Promise.resolve(emptyPage),
                trialistCount > 0 ? fetchClubPlayers(clubId, 'TRIALIST', 0, 50) : Promise.resolve(emptyPage),
            ]);
            if (requestId !== requestRef.current) return;
            const players = pages.flatMap((page) => page.content);
            setResult({
                clubId,
                players: players.filter((player) =>
                    (player.status === 'ACTIVE' || player.status === 'TRIALIST') &&
                    player.parentalConsentStatus !== 'CONFIRMED' &&
                    (player.requiresParentalConsent || ['PENDING', 'EXPIRED', 'DECLINED'].includes(player.parentalConsentStatus ?? '')),
                ).sort((a, b) => Number(a.parentalConsentStatus === 'PENDING') - Number(b.parentalConsentStatus === 'PENDING')),
                reviewed: players.length,
                total: pages.reduce((total, page) => total + page.totalElements, 0),
            });
        } catch {
            if (requestId !== requestRef.current) return;
            setError(true);
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [clubId, enabled, activeCount, trialistCount]);

    useEffect(() => {
        void retry();
        return () => { requestRef.current += 1; };
    }, [retry]);

    return { result: result?.clubId === clubId ? result : null, loading, error, retry };
}
