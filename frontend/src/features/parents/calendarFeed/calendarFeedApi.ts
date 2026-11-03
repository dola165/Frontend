import { apiClient, DEPLOYMENT_URLS } from '../../../api/axiosConfig';

/** The signed-in parent's private calendar link (W4): on or off; the link itself is shown only when it is made. */
export interface CalendarFeedStatus { on: boolean; createdAt: string | null; lastReadAt: string | null }

export const calendarFeedStatus = async (signal?: AbortSignal) => (await apiClient.get<CalendarFeedStatus>('/calendar/family', { signal })).data;
/** A new link (the one before stops); `path` is on this site. */
export const makeCalendarFeed = async () => (await apiClient.post<{ path: string; createdAt: string }>('/calendar/family')).data;
export const stopCalendarFeed = () => apiClient.delete('/calendar/family');

/**
 * The link as calendars take it: the full address on the API's own host (the site, or wherever the API is served), its
 * webcal form (Apple) and Google's subscribe page.
 */
export function calendarLinks(path: string, service = DEPLOYMENT_URLS.serviceBaseUrl) {
    const url = new URL(path, service).toString();
    const webcal = url.replace(/^https?:\/\//, 'webcal://');
    return { url, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
}
