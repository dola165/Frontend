import { safeNotificationLink } from '../../utils/notificationDestinations';
import { homePendingDestination } from '../feed/homePendingDestinations';
import { announceHomeInboxRead } from '../feed/homePendingSignals';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export interface RequestItem { key: string; family: string; id: number; title: string; context: string; status: string; direction: string; actionable: boolean; updatedAt: string; destination: string; actionLabel: string }
export interface RequestPage { items: RequestItem[]; counts: { incoming: number; actionable: number; outgoing: number; history: number }; total: number; hasMore: boolean; unavailableSources: string[] }
export interface PendingRequests { items: RequestItem[]; unavailableSources: string[]; complete: boolean }
/** One server snapshot of all actionable work; Home never assembles independent offset pages. */
export const pendingRequests = (sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.get<PendingRequests>('/requests/pending', { signal, _authSessionId: sessionId } as AuthSessionRequestConfig).then(r => {
    if (r.data.complete !== true) throw new Error('Pending requests snapshot is incomplete');
    return r.data;
  });
export interface EventItem { kind: 'TOURNAMENT' | 'SCHEDULE' | 'SESSION' | 'TRYOUT'; id: number; name: string; activity: string; status: string; startsAt: string | null; endsAt: string | null; location: string | null; context: string; destination: string; recurring: boolean }
export interface EventPage { items: EventItem[]; total: number; hasMore: boolean }
export const requests = (view: string, page: number, sessionId: AuthSessionId, signal: AbortSignal, size = 20) =>
  apiClient.get<RequestPage>('/requests', { params: { view, page, size }, signal, _authSessionId: sessionId } as AuthSessionRequestConfig).then(r => {
    if (view === 'INCOMING' && page === 0 && size === 1 && !signal.aborted) announceHomeInboxRead(sessionId);
    return r.data;
  });
export const eventSearch = (params: Record<string, string | number | undefined>, sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.get<EventPage>('/tournaments/discovery', { params, signal, _authSessionId: sessionId } as AuthSessionRequestConfig).then(r => r.data);

// This read projection has its own narrow route contract. Notification links keep their existing allowlist.
function wireRequestDestination(value: string): string | null {
  if (!value || /[\\\s%]/.test(value) || value.startsWith('//')) return null;
  // Exact fixture concern links produced by CompetitionConcernRequests; no general workspace grant.
  const concern = /^\/tournaments\/([1-9]\d*)(?:\?tab=matches&fixtureId=([1-9]\d*)|\/workspace\?view=schedule&fixtureId=([1-9]\d*))$/.exec(value);
  if (concern) return [concern[1], concern[2] ?? concern[3]].every(id => Number.isSafeInteger(Number(id))) ? value : null;
  const match = /^\/(?:club-operations|map|account|my-organizations|parent|reports|admin|referees\/me|profile\/[1-9]\d*|agent|notifications|clubs\/[1-9]\d*\/workspace|tryouts\/[1-9]\d*|tournaments\/[1-9]\d*|match(?:es|-exchange)\/[1-9]\d*|projects\/[1-9]\d*)(?:[?#].*)?$/.test(value);
  if (!match) return null;
  const url = new URL(value, 'https://requests.invalid');
  if (url.origin !== 'https://requests.invalid' || value.split(/[?#]/)[0] !== url.pathname) return null;
  // A project step waiting on the person (PROJECT_STEP) opens its project, and nothing else.
  if (url.pathname.startsWith('/projects/')) return !url.search && !url.hash ? value : null;
  if (url.pathname === '/my-organizations') {
    return !url.hash && /^\?itemId=[1-9]\d*$/.test(url.search)
      && Number.isSafeInteger(Number(url.searchParams.get('itemId'))) ? value : null;
  }
  if (url.pathname === '/club-operations') {
    return !url.hash && /^\?appointmentId=[1-9]\d*$/.test(url.search)
      && Number.isSafeInteger(Number(url.searchParams.get('appointmentId'))) ? value : null;
  }
  if (url.pathname === '/map') {
    return !url.hash && /^\?plans=(?:staff|family)&plan=[1-9]\d*$/.test(url.search)
      && Number.isSafeInteger(Number(url.searchParams.get('plan'))) ? value : null;
  }
  if (url.pathname.startsWith('/tryouts/') && (url.search || url.hash || !Number.isSafeInteger(Number(url.pathname.split('/')[2])))) return null;
  if (url.pathname === '/admin' && !/^\?tab=safety(?:&itemId=[1-9]\d*)?$/.test(url.search)) return null;
  if (url.pathname === '/reports' && url.search && !/^\?itemId=[1-9]\d*$/.test(url.search)) return null;
  for (const [key, item] of url.searchParams) {
    if (!['tab', 'applicationId', 'itemId', 'venueId', 'bookingId', 'representation', 'approach', 'invitationId'].includes(key) || url.searchParams.getAll(key).length !== 1) return null;
    if (key !== 'tab' && !/^[1-9]\d*$/.test(item)) return null;
    if (key === 'tab' && !/^[a-z-]+$/.test(item)) return null;
  }
  if (url.hash && !/^#(?:appointment|offer)-[1-9]\d*$/.test(url.hash)) return null;
  return value;
}
export function requestDestination(value: string, family?: RequestItem['family']): string | null {
  // Sealed officer work links only to its canonical record. The source still enforces officer scope.
  // A place offered to the family (ADMISSION_PLACE) opens only its own case, on the agreement, for that player.
  if (family === 'ADMISSION_PLACE') {
    const place = /^\/admissions\/cases\/([1-9]\d*)\?tab=agreement&player=([1-9]\d*)$/.exec(value);
    return place && place.slice(1).every(id => Number.isSafeInteger(Number(id))) ? value : null;
  }
  if (family === 'WELFARE_WORK') {
    const welfare = /^\/clubs\/([1-9]\d*)\/office\?tab=tools&tool=welfare&record=([1-9]\d*)(?:&squad=([1-9]\d*))?$/.exec(value);
    if (welfare && welfare[0] === value && welfare.slice(1).filter(Boolean).every(id => Number.isSafeInteger(Number(id)))) return value;
  }
  if (value.startsWith('/jobs')) {
    const safe = safeNotificationLink(value);
    return safe ? safe.pathname : null;
  }
  if (value.startsWith('/requests') || value.startsWith('/parent?tab=connections&permissionId=')) {
    const safe = safeNotificationLink(value);
    return safe ? safe.pathname + safe.search + safe.hash : null;
  }
  const home = homePendingDestination(value);
  if (home) return home;
  const destination = wireRequestDestination(value);
  if (!destination) return null;
  if (destination.startsWith('/club-operations?appointmentId=')) return destination.replace('/club-operations?', '/requests?');
  if (destination.startsWith('/notifications')) return destination.replace('/notifications', '/requests?view=updates').replace('updates?', 'updates&');
  return destination;
}
export function eventDestination(item: EventItem): string | null {
  const patterns = { TOURNAMENT: /^\/tournaments\/[1-9]\d*$/, SCHEDULE: /^\/(?:calendar\?eventId=[1-9]\d*|match(?:es|-exchange)\/[1-9]\d*)$/, SESSION: /^\/clubs\/[1-9]\d*\?tab=teams&squad=[1-9]\d*$/, TRYOUT: /^\/clubs\/[1-9]\d*\?tab=tryouts$/ };
  return patterns[item.kind]?.test(item.destination) ? item.destination : null;
}
