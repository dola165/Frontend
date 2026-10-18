import { useEffect, useState } from 'react';
import { chatApi, type UserSearchResult } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';
import { isCurrentAuthSession } from '../../utils/authStorage';

/** One debounced chat search. Results belong to their query, exclusions and account; old answers never replace them. */
export function useChatPeopleSearch(query: string, excludedIds: number[]) {
    const { sessionId } = useAuth();
    const normalized = query.trim();
    const excludedKey = [...new Set(excludedIds)].sort((a, b) => a - b).join(',');
    const [attempt, setAttempt] = useState(0);
    const scope = JSON.stringify([sessionId, normalized, excludedKey, attempt]);
    const [result, setResult] = useState<{ scope: string; items: UserSearchResult[]; failed: boolean } | null>(null);
    const enabled = normalized.length >= 2;
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        const current = () => active && isCurrentAuthSession(sessionId);
        const timer = setTimeout(() => {
            if (!current()) return;
            const excluded = new Set(excludedKey.split(',').map(Number));
            void chatApi.searchUsers(normalized).then(({ data }) => {
                if (current()) setResult({ scope, items: data.content.filter(person => !person.isMinor && !excluded.has(person.id)), failed: false });
            }).catch(() => { if (current()) setResult({ scope, items: [], failed: true }); });
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [enabled, normalized, excludedKey, scope, sessionId]);
    const current = enabled && result?.scope === scope ? result : null;
    return { results: current?.items ?? [], loading: enabled && current === null, failed: current?.failed ?? false,
        retry: () => setAttempt(value => value + 1) };
}
