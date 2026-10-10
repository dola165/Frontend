import { useState } from 'react';
import type { BadgeTone, FixtureTone } from '../../design/primitives';
import { useAuth } from '../../context/AuthContext';
import { requests } from '../requests/api';
import { fetchMySchedule } from '../schedule/api';
import * as squadApi from '../squadCommunication/api';
import { useSquadSchedule, type SquadCalendarEvent } from '../squadCommunication/useSquadSchedule';
import { eventKind } from '../clubWorkspace/fixtures';
import { useWorldData, type WorldData } from '../world/useWorldData';

export interface WeekEntry { key: string; startsAt: string; title: string; meta: string; tone: FixtureTone; badge: { label: string; tone: BadgeTone }; to: string }

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const kind = (type: string) => eventKind[type as keyof typeof eventKind] ?? eventKind.ACTIVITY;

/** Where an entry opens: the match page, the squad session, or the schedule that holds it. */
function destination(event: SquadCalendarEvent) {
    if (event.matchExchangeId) return `/match-exchange/${event.matchExchangeId}`;
    if (event.origin === 'SQUAD_SESSION' && event.squadId) {
        const at = new Date(event.startsAt);
        return Number.isNaN(at.getTime()) ? `/squads/${event.squadId}?tab=sessions` : `/squads/${event.squadId}?tab=sessions&sessionId=${event.eventId}&at=${at.toISOString()}`;
    }
    return event.squadId ? `/calendar?scope=squad&squadId=${event.squadId}` : '/calendar';
}

function squadEntry(event: SquadCalendarEvent): WeekEntry {
    const k = kind(event.eventType);
    const cancelled = event.status === 'CANCELLED';
    const replies = event.responseSummary && event.responseSummary.total > 0 ? `${event.responseSummary.going} of ${event.responseSummary.total} going` : null;
    return {
        key: event.id, startsAt: event.startsAt, title: event.title, to: destination(event), tone: cancelled ? 'neutral' : k.tone,
        meta: [event.hostSquadName, event.locationText, cancelled ? null : replies].filter(Boolean).join(' · '),
        badge: cancelled ? { label: 'Cancelled', tone: 'danger' } : { label: k.label, tone: k.badge },
    };
}

/**
 * Home's "This week": the next seven days of my squads' sessions and matches (a parent's squads are
 * their children's), my own calendar entries, and the decisions waiting for me. Each part loads on
 * its own, so one failure never hides the others.
 */
export function useThisWeek(spaces: WorldData<squadApi.SquadSpace[]>) {
    const { sessionId } = useAuth();
    const [range] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { now: now.getTime(), from: stamp(start), to: stamp(new Date(start.getTime() + 8 * 86_400_000)) };
    });
    const squads = useSquadSchedule(spaces.data ?? [], range.from, range.to, 0, undefined, false);
    const personal = useWorldData(`home-personal:${sessionId}:${range.from}`, signal => fetchMySchedule(range.from, range.to, signal), 'Your calendar could not load.');
    const waiting = useWorldData(`home-waiting:${sessionId}`, signal => requests('INCOMING', 0, sessionId, signal, 10), 'Decisions waiting for you could not load.');

    const upcoming = (startsAt: string, endsAt: string) => (Date.parse(endsAt || startsAt) || 0) >= range.now;
    const entries: WeekEntry[] = [
        ...squads.events.filter(event => upcoming(event.startsAt, event.endsAt)).map(squadEntry),
        ...(personal.data ?? []).filter(event => upcoming(event.startsAt, event.endsAt)).map(event => {
            const k = kind(event.eventType);
            return { key: `personal:${event.occurrenceId}`, startsAt: event.startsAt, title: event.title, to: '/calendar?scope=personal', tone: k.tone,
                meta: [event.locationName, 'Your calendar'].filter(Boolean).join(' · '), badge: { label: k.label, tone: k.badge } } satisfies WeekEntry;
        }),
    ].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const unique = [...new Map(entries.map(entry => [entry.key, entry])).values()];

    const scheduleLoading = spaces.loading || (Boolean(spaces.data?.length) && squads.loading) || personal.loading;
    const scheduleError = [spaces.error, squads.error, personal.error].filter(Boolean)[0] ?? '';
    const decisions = waiting.data?.items.filter(item => item.actionable) ?? [];
    return {
        entries: unique, scheduleLoading, scheduleError, retrySchedule: () => { spaces.retry(); personal.retry(); },
        decisions, decisionCount: waiting.data?.counts.actionable ?? 0, decisionsPartial: Boolean(waiting.data?.unavailableSources.length),
        decisionsLoading: waiting.loading, decisionsError: waiting.error, retryDecisions: waiting.retry,
    };
}
