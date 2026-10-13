import { useEffect } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { AuthUser } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { RoleProfile } from '../roles/domain';
import { activityFromLinks, applyActivity } from './applyActivity';
import { fetchFeedPreferences } from './startApi';

/** Looked at once per account per visit; a person who skipped the question is not asked again by the app. */
const decided = new Set<number>();

/**
 * Someone who skipped "What do you do in football?" still gets the right start the day a club, a squad or a child is
 * linked to them: their links then set the football role, World's page and the pin, as the answer would have.
 * Only when they never answered and have no football role yet; what they chose themselves is never overwritten.
 */
export function useAutomaticActivity(user: AuthUser | null) {
    const copy = useJourneyCopy();
    const userId = user?.id;
    const implied = activityFromLinks(user?.navigationCapabilities);
    useEffect(() => {
        if (!userId || !implied || decided.has(userId)) return;
        decided.add(userId);
        // Safe to finish after the effect is gone: it writes once, and only what the links say.
        void (async () => {
            try {
                const [preferences, roles] = await Promise.all([fetchFeedPreferences(), apiClient.get<RoleProfile[]>('/users/me/roles').then(r => r.data).catch(() => [] as RoleProfile[])]);
                if (preferences.activity || roles.length) return;
                await applyActivity(userId, implied, copy);
            } catch {
                // An older server has no preferences; the links already decide the tabs and World's page.
                decided.delete(userId);
            }
        })();
    }, [userId, implied, copy]);
}
