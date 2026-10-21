import { useEffect, useRef } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth, type AuthUser } from '../../context/AuthContext';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import type { RoleProfile } from '../roles/domain';
import { activityFromLinks, applyActivity } from './applyActivity';
import { fetchFeedPreferences } from './startApi';

/**
 * Someone who skipped "What do you do in football?" still gets the right start the day a club, a squad or a child is
 * linked to them: their links then set the football role, World's page and the pin, as the answer would have.
 * Only when they never answered and have no football role yet; what they chose themselves is never overwritten.
 */
export function useAutomaticActivity(user: AuthUser | null) {
    const copy = useJourneyCopy();
    const { sessionId } = useAuth();
    const decided = useRef(new Set<string>());
    const userId = user?.id;
    const implied = activityFromLinks(user?.navigationCapabilities);
    useEffect(() => {
        const key = `${userId}:${sessionId}`;
        const decisions = decided.current;
        if (!userId || !implied || decisions.has(key)) return;
        decisions.add(key);
        const controller = new AbortController();
        let finished = false;
        void (async () => {
            try {
                const [preferences, roles] = await Promise.all([fetchFeedPreferences(controller.signal), apiClient.get<RoleProfile[]>('/users/me/roles', { signal: controller.signal }).then(r => r.data)]);
                if (controller.signal.aborted) return;
                // A failed role read is unknown, never permission to replace someone's existing public roles.
                if (!preferences.activity && !roles.length) await applyActivity(userId, implied, copy);
                finished = true;
            } catch {
                if (!controller.signal.aborted) decisions.delete(key);
            }
        })();
        return () => {
            controller.abort();
            if (!finished) decisions.delete(key);
        };
    }, [userId, sessionId, implied, copy]);
}
