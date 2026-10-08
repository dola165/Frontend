import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';

export interface RequestItem { key: string; family: string; id: number; title: string; context: string; status: string; direction: string; actionable: boolean; updatedAt: string; destination: string; actionLabel: string }
export interface RequestPage { items: RequestItem[]; counts: { incoming: number; actionable: number; outgoing: number; history: number }; total: number; hasMore: boolean; unavailableSources: string[] }
export interface EventItem { kind: 'TOURNAMENT' | 'SCHEDULE' | 'SESSION' | 'TRYOUT'; id: number; name: string; activity: string; status: string; startsAt: string | null; endsAt: string | null; location: string | null; context: string; destination: string; recurring: boolean }
export interface EventPage { items: EventItem[]; total: number; hasMore: boolean }
export const requests = (view: string, page: number, sessionId: AuthSessionId, signal: AbortSignal, size = 20) =>
  apiClient.get<RequestPage>('/requests', { params: { view, page, size }, signal, _authSessionId: sessionId } as AuthSessionRequestConfig).then(r => r.data);
export const eventSearch = (params: Record<string, string | number | undefined>, sessionId: AuthSessionId, signal: AbortSignal) =>
  apiClient.get<EventPage>('/tournaments/discovery', { params, signal, _authSessionId: sessionId } as AuthSessionRequestConfig).then(r => r.data);

// This read projection has its own narrow route contract. Notification links keep their existing allowlist.
export function requestDestination(value: string): string | null {
  if (!value || /[\\\s%]/.test(value) || value.startsWith('//')) return null;
  const match = /^\/(?:club-operations|map|account|parent|reports|admin|referees\/me|profile\/[1-9]\d*|agent|notifications|clubs\/[1-9]\d*\/workspace|tryouts\/[1-9]\d*|tournaments\/[1-9]\d*|match-exchange\/[1-9]\d*)(?:[?#].*)?$/.test(value);
  if (!match) return null;
  const url = new URL(value, 'https://requests.invalid');
  if (url.origin !== 'https://requests.invalid' || value.split(/[?#]/)[0] !== url.pathname) return null;
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
export function eventDestination(item: EventItem): string | null {
  const patterns = { TOURNAMENT: /^\/tournaments\/[1-9]\d*$/, SCHEDULE: /^\/(?:calendar\?eventId=[1-9]\d*|match-exchange\/[1-9]\d*)$/, SESSION: /^\/clubs\/[1-9]\d*\?tab=teams&squad=[1-9]\d*$/, TRYOUT: /^\/clubs\/[1-9]\d*\?tab=tryouts$/ };
  return patterns[item.kind]?.test(item.destination) ? item.destination : null;
}
