import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { fetchClubManagementOverview } from '../clubs/api';
import type { ClubManagementOverview } from '../clubs/domain';
import { fetchClubSchedule, type ScheduleEventOccurrence } from '../schedule/api';
import { extractApiErrorMessage } from '../../utils/apiError';

const toScheduleDateTime = (value: Date) => {
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
};

/**
 * What every workspace page needs about the club: the management overview (role, counts,
 * decisions), its public name and crest, and the next seven days of the club calendar.
 * Each request discards answers that arrive after a newer one started.
 */
export function useClubOverview(clubId: number) {
    const [overview, setOverview] = useState<ClubManagementOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Refused rather than failed: retrying cannot help, so the page says who the workspace is for.
    const [forbidden, setForbidden] = useState(false);
    const overviewRequest = useRef(0);
    const [club, setClub] = useState<{ name: string | null; logoUrl: string | null }>({ name: null, logoUrl: null });
    const [events, setEvents] = useState<ScheduleEventOccurrence[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(true);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const scheduleRequest = useRef(0);

    const reload = useCallback(async () => {
        const request = ++overviewRequest.current;
        setLoading(true);
        setError(null);
        setForbidden(false);
        try {
            const response = await fetchClubManagementOverview(clubId);
            if (request === overviewRequest.current) setOverview(response);
        } catch (failure) {
            if (request === overviewRequest.current) {
                setError(extractApiErrorMessage(failure, 'Failed to load club management data.'));
                setForbidden((failure as { response?: { status?: number } } | null)?.response?.status === 403);
            }
        } finally {
            if (request === overviewRequest.current) setLoading(false);
        }
    }, [clubId]);

    const reloadSchedule = useCallback(async () => {
        const request = ++scheduleRequest.current;
        setScheduleLoading(true);
        setScheduleError(null);
        const from = new Date(), to = new Date(from);
        to.setDate(to.getDate() + 7);
        try {
            const list = await fetchClubSchedule(clubId, toScheduleDateTime(from), toScheduleDateTime(to));
            if (request !== scheduleRequest.current) return;
            const now = Date.now();
            setEvents(list
                .filter(event => event.status?.toUpperCase() !== 'CANCELLED' && new Date(event.endsAt).getTime() >= now)
                .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
        } catch (failure) {
            if (request !== scheduleRequest.current) return;
            setEvents([]);
            setScheduleError(extractApiErrorMessage(failure, 'Failed to load upcoming schedule.'));
        } finally {
            if (request === scheduleRequest.current) setScheduleLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        const controller = new AbortController();
        void reload();
        void reloadSchedule();
        void apiClient.get<{ name?: string; logoUrl?: string | null }>(`/clubs/${clubId}`, { signal: controller.signal })
            .then(response => { if (!controller.signal.aborted) setClub({ name: response.data.name ?? null, logoUrl: response.data.logoUrl ?? null }); })
            .catch(() => { /* The workspace stays usable without the public club summary. */ });
        return () => controller.abort();
    }, [clubId, reload, reloadSchedule]);

    return {
        overview, loading, error, forbidden, reload,
        clubName: club.name, clubLogoUrl: club.logoUrl,
        schedule: { events, loading: scheduleLoading, error: scheduleError, retry: () => { void reloadSchedule(); } },
    };
}
