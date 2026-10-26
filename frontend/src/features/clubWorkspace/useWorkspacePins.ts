import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePins, type Pin } from '../../components/layout/header/pins/usePins';
import { readPins, writePins, MAX_PINS } from '../../components/layout/header/pins/pinStore';
import type { PinIcon } from '../../components/layout/header/pins/pinIcons';
import { parseWorkspaceTab, type TabItem, type WorkspaceTab } from '../../components/workspace/types';
import { operationModule } from '../clubOperations/workspaceNavigation';

/** The address of a workspace tool, exactly as the header pins store it. */
export const toolPath = (club: number, tab: WorkspaceTab) => `/clubs/${club}/workspace?tab=${tab}`;

const iconFor = (tab: WorkspaceTab): PinIcon => {
    if (tab === 'squads' || tab === 'coach-hub') return 'squad';
    if (['players', 'personnel', 'invites'].includes(tab)) return 'people';
    if (['store'].includes(tab)) return 'store';
    if (['campaigns'].includes(tab)) return 'family';
    if (['jobs', 'finance', 'programmes'].includes(tab)) return 'briefcase';
    if (['settings', 'workspace-settings'].includes(tab)) return 'settings';
    if (['attendance'].includes(tab)) return 'calendar';
    if (['facilities'].includes(tab)) return 'venue';
    if (operationModule(tab)) return 'clipboard';
    return 'workspace';
};

/**
 * Pinned workspace tools are the same pins as the header's: pinning a tool here gives it a tab in
 * the top bar too, and unpinning it anywhere removes it everywhere. Nothing is pinned automatically,
 * except that shortcuts chosen before pins existed are carried over once.
 */
export function useWorkspacePins(club: number, tabs: TabItem[], ready: boolean) {
    const { user } = useAuth();
    const userId = user?.id;
    const state = usePins(userId, user?.navigationCapabilities);
    const prefix = `/clubs/${club}/workspace?tab=`;

    useEffect(() => {
        // Wait until the person's tools are known, so no saved shortcut is dropped as unavailable.
        if (!userId || !ready) return;
        const legacyKey = `gk-club-shortcuts-v1:${club}:${userId}`;
        let saved: unknown = null;
        try { saved = JSON.parse(localStorage.getItem(legacyKey) ?? 'null'); } catch { /* Nothing to carry over. */ }
        if (!Array.isArray(saved)) return;
        const current = readPins(userId);
        const carried = saved.map(id => parseWorkspaceTab(id === 'my-squads' ? 'squads' : String(id))).filter((id): id is WorkspaceTab => Boolean(id))
            .map(id => ({ id, tab: tabs.find(tab => tab.id === id) })).filter(item => item.tab && !current.some(pin => pin.path === toolPath(club, item.id)))
            .map(item => ({ path: toolPath(club, item.id), label: item.tab!.label, icon: iconFor(item.id) }));
        writePins(userId, [...current, ...carried].slice(0, MAX_PINS));
        try { localStorage.removeItem(legacyKey); } catch { /* Harmless: the copy is idempotent. */ }
    }, [club, userId, tabs, ready]);

    const pinned = useMemo(() => state.pins
        .filter(pin => pin.path.startsWith(prefix))
        .map(pin => parseWorkspaceTab(pin.path.slice(prefix.length)))
        .filter((id): id is WorkspaceTab => Boolean(id))
        .map(id => tabs.find(tab => tab.id === id))
        .filter((tab): tab is TabItem => Boolean(tab)), [state.pins, prefix, tabs]);

    const isPinned = useCallback((tab: WorkspaceTab) => state.isPinned(toolPath(club, tab)), [state, club]);
    const toggle = useCallback((tab: TabItem) => {
        const path = toolPath(club, tab.id);
        if (state.isPinned(path)) state.unpin(path);
        else state.pin({ path, label: tab.label, icon: iconFor(tab.id) } satisfies Pin);
    }, [state, club]);
    /** Swaps a tool with its neighbour among this workspace's pins, leaving other pins where they are. */
    const move = useCallback((tab: WorkspaceTab, direction: -1 | 1) => {
        if (!userId) return;
        const all = readPins(userId);
        const mine = all.map((pin, index) => ({ pin, index })).filter(item => item.pin.path.startsWith(prefix));
        const at = mine.findIndex(item => item.pin.path === toolPath(club, tab));
        const other = mine[at + direction];
        if (at < 0 || !other) return;
        const next = [...all];
        [next[mine[at].index], next[other.index]] = [next[other.index], next[mine[at].index]];
        writePins(userId, next);
    }, [userId, prefix, club]);

    return { pinned, isPinned, toggle, move, full: state.full, available: Boolean(userId) };
}
export type WorkspacePins = ReturnType<typeof useWorkspacePins>;
