import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { extractApiErrorMessage } from '../../utils/apiError';
import * as api from '../squadCommunication/api';
import { useWorldData } from '../world/useWorldData';
import { isPinned, pinnedUntil } from './pinning';

export interface PinnedAnnouncement { squad: api.SquadSpace; message: api.SquadMessage }

/**
 * Announcements still pinned in the squads I belong to (as coach, player or parent), newest first.
 * Backend needed: one `active announcements` endpoint would replace a request per squad.
 */
export function useHomeAnnouncements() {
    const { sessionId } = useAuth();
    const [now] = useState(() => Date.now());
    const [read, setRead] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState<number | null>(null);
    const [failed, setFailed] = useState<{ id: number; message: string } | null>(null);
    const pinned = useWorldData<PinnedAnnouncement[]>(`home-announcements:${sessionId}`, async signal => {
        const squads = await api.spaces(signal);
        const lists = await Promise.all(squads.map(async squad => (await api.messages(squad.id, 'ANNOUNCEMENT', null, signal))
            .filter(message => isPinned(message, now)).map(message => ({ squad, message }))));
        return lists.flat().sort((a, b) => Date.parse(b.message.created_at) - Date.parse(a.message.created_at));
    }, 'Announcements could not load.');

    async function markRead(item: PinnedAnnouncement) {
        if (busy !== null) return;
        setBusy(item.message.id); setFailed(null);
        try {
            await api.acknowledge(item.squad.id, item.message.id);
            setRead(current => ({ ...current, [item.message.id]: new Date().toISOString() }));
        } catch (cause) {
            setFailed({ id: item.message.id, message: extractApiErrorMessage(cause, 'This could not be marked as read. Try again.') });
        } finally { setBusy(null); }
    }

    const items = (pinned.data ?? []).map(item => read[item.message.id] ? { ...item, message: { ...item.message, acknowledged_at: read[item.message.id] } } : item);
    return { items, loading: pinned.loading, error: pinned.error, retry: pinned.retry, markRead, busy, failed, until: (item: PinnedAnnouncement) => pinnedUntil(item.message) };
}
export type HomeAnnouncementsState = ReturnType<typeof useHomeAnnouncements>;
