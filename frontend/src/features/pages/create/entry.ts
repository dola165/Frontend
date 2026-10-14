import { accessibleClubs } from '../../../components/layout/clubAccess';
import { hasNavigationCapability, type NavigationCapabilities } from '../../../context/navigationCapabilities';
import type { PageRef } from '../api';
import type { PageKind } from '../model/kinds';

/**
 * One "create" entry point for the whole app. Every place that offers it links to the current page with `?create=`
 * (and `?claim=` for a known page), and `CreatePageHost`, mounted once, opens the sheet over whatever is on screen.
 * So the sheet never needs a page of its own, and Back closes it.
 */
export const CREATE_PARAM = 'create';
export const CLAIM_PARAM = 'claim';
export const FROM_PARAM = 'from';
/** Set when the Draw room sent the person to set up an organiser: afterwards the way back leads there. */
export const DRAW_PARAM = 'draw';

const PARAM_OF_KIND: Record<PageKind, string> = { CLUB: 'club', FAN_CLUB: 'fan-club', BUSINESS: 'business', PAGE: 'page', VENUE: 'venue' };
export const kindFromParam = (value: string | null): PageKind | null =>
  (Object.entries(PARAM_OF_KIND).find(([, param]) => param === value)?.[0] as PageKind | undefined) ?? null;

/** Where the person pressed "create": recorded in the funnel, and it decides whether Club is pre-chosen. */
export type CreateFrom = 'home' | 'account' | 'pins' | 'my-club' | 'world' | 'world-clubs' | 'search' | 'fundraising' | 'jobs' | 'store' | 'arrange' | 'start' | 'profile' | 'organizations' | 'roles' | 'link' | 'dola';
/** Entry points where the person was already thinking football: the sheet starts on Club. */
export const FOOTBALL_ENTRIES: readonly CreateFrom[] = ['my-club', 'world-clubs', 'arrange', 'fundraising', 'jobs', 'store', 'start', 'profile'];
export const fromParam = (value: string | null): CreateFrom => (value && (['home', 'account', 'pins', 'my-club', 'world', 'world-clubs', 'search', 'fundraising', 'jobs', 'store', 'arrange', 'start', 'profile', 'organizations', 'roles', 'link', 'dola'] as string[]).includes(value) ? value as CreateFrom : 'link');

type Location = { pathname: string; search: string; hash?: string };
const without = (search: string) => { const params = new URLSearchParams(search); for (const key of [CREATE_PARAM, CLAIM_PARAM, FROM_PARAM, DRAW_PARAM]) params.delete(key); return params; };
const href = (location: Location, params: URLSearchParams) => `${location.pathname}?${params}${location.hash ?? ''}`;

export function createHref(location: Location, kind: PageKind | null, from: CreateFrom, draw = false): string {
  const params = without(location.search);
  params.set(CREATE_PARAM, kind ? PARAM_OF_KIND[kind] : 'any');
  params.set(FROM_PARAM, from);
  if (draw) params.set(DRAW_PARAM, '1');
  return href(location, params);
}
export function claimHref(location: Location, ref: PageRef, from: CreateFrom): string {
  const params = without(location.search);
  params.set(CLAIM_PARAM, `${ref.type}-${ref.id}`);
  params.set(FROM_PARAM, from);
  return href(location, params);
}
export const refFromParam = (value: string | null): PageRef | null => {
  const match = /^(club|organization)-(\d{1,15})$/.exec(value ?? '');
  return match ? { type: match[1] as PageRef['type'], id: Number(match[2]) } : null;
};
/** The address with the sheet closed. */
export const withoutCreate = (search: string) => { const rest = without(search).toString(); return rest ? `?${rest}` : ''; };

/** A page of their own: a club they are at, or an organisation or venue they run. The promotional entry points hide then. */
export const hasOwnPage = (capabilities?: NavigationCapabilities) =>
  accessibleClubs(capabilities).some(club => club.relationships.some(relation => relation !== 'Agent engagement'))
  || hasNavigationCapability(capabilities, 'organization.workspace') || hasNavigationCapability(capabilities, 'venue.workspace');

export const pagePath = (ref: PageRef) => (ref.type === 'club' ? `/clubs/${ref.id}` : `/organizations/${ref.id}`);
