import { apiClient } from '../../api/axiosConfig';
import type { BoxKey, BusinessKind, InvolvedPart, LockedAction, PageKind, PageLayout, SetupKey, VerificationState } from './model/kinds';
import type { CrestDesign } from './model/crest';
import type { CoverPhoto } from './model/photos';

/** Which page: a club lives at /clubs/:id, every other page at /organizations/:id. */
export interface PageRef { type: 'club' | 'organization'; id: number }
export const pageBase = (ref: PageRef) => `${ref.type === 'club' ? '/clubs' : '/organizations'}/${ref.id}/page`;
export const sameRef = (a: PageRef | null | undefined, b: PageRef | null | undefined) => Boolean(a && b && a.type === b.type && a.id === b.id);

export interface Town { name: string; latitude: number | null; longitude: number | null }
export type CrestState = { kind: 'generated'; design: CrestDesign; kept: boolean; url: string } | { kind: 'image'; url: string; kept: boolean };
export type CoverState = { kind: 'photo'; photo: CoverPhoto; url: string } | { kind: 'image'; url: string };
export interface PageIdentity {
  version: number;
  name: string;
  tagline: string;
  about: string;
  /** The About is written for the owner from the type, town and ages until they edit it themselves. */
  aboutAuto: boolean;
  language?: 'en' | 'ka';
  town: Town;
  crest: CrestState;
  cover: CoverState | null;
  contact: { phone: string; email: string };
  social: { website: string; instagram: string; facebook: string };
  businessKind: BusinessKind | null;
  clubCategory: string | null;
}
export type Surface = 'GRASS' | 'ARTIFICIAL' | 'HYBRID' | 'INDOOR';
export type PitchSize = '5v5' | '7v7' | '9v9' | '11v11';
export interface Ground { id: number; name: string; address: string; town: string; latitude: number; longitude: number; surface: Surface; size: PitchSize; indoor: boolean; pitchId: string | null; venueId: number | null }
export type Gender = 'MALE' | 'FEMALE' | 'MIXED';
export interface SquadItem { id: number; name: string; ageGroup: string; gender: Gender; format: string; days: number[]; time: string | null; groundId: number | null; players: number; coach: { userId: number; name: string; you: boolean } | null }
export interface FeeBand { min: number; max: number; currency: 'GEL' | 'USD' | 'EUR'; period: 'MONTH'; free: 'NONE' | 'SOME' | 'ALL' }
export interface StaffMember { userId: number; fullName: string; avatarUrl: string | null; role: 'OWNER' | 'CLUB_ADMIN' | 'COACH'; title: string }
export type StaffRole = 'COACH' | 'ASSISTANT' | 'ADMIN';
export interface StaffInvite { id: number; name: string; phone: string; role: StaffRole; squadId: number | null; status: 'INVITED' | 'JOINED'; code: string; at: string }
export interface Sponsor { id: number; name: string; logoUrl: string | null; websiteUrl: string | null; organizationId: number | null }
export interface Honour { id: number; title: string; year: number }

export interface PageBoxes {
  grounds: { version: number; items: Ground[] };
  squads: { version: number; items: SquadItem[] };
  fees: { version: number; band: FeeBand | null };
  staff: { version: number; members: StaffMember[]; invites: StaffInvite[] };
  players: { version: number; shared: boolean; links: Record<string, string>; waiting: number };
  sponsors: { version: number; items: Sponsor[] };
  honours: { version: number; items: Honour[] };
  involved: { version: number; parts: InvolvedPart[] };
}
export type SavableBox = keyof PageBoxes;

export interface PageView {
  ref: PageRef;
  organizationId: number;
  clubId: number | null;
  kind: PageKind;
  status: 'DRAFT' | 'LIVE';
  claim: { state: 'UNCLAIMED' | 'PENDING'; role: string | null; mine: boolean } | null;
  verification: VerificationState;
  viewer: { role: 'OWNER' | 'ADMIN' | 'COACH' | null; canEdit: boolean; editable: 'ALL' | BoxKey[]; canClaim: boolean };
  identity: PageIdentity;
  layout: PageLayout & { version: number };
  boxes: PageBoxes;
  setup: { items: { key: SetupKey; done: boolean }[]; done: number; total: number; next: SetupKey | null; complete: boolean; completedAt: string | null };
  goLive: { ready: boolean; missing: 'name'[] };
  links: CreatedPage;
  /** The owner's own phone and email, offered as one tap, never published without it. */
  suggestions: { phone: string; email: string; fees?: { min: number; max: number; currency: FeeBand['currency']; /** Null: the whole country. */ town: string | null; clubs: number } | null } | null;
  createdAt: string;
  liveAt: string | null;
}

export interface CreatedPage { id: number; clubId: number | null; profilePath: string; workspacePath: string }
export interface SimilarPage { ref: PageRef; name: string; town: string; kind: PageKind; crestUrl: string | null; status: 'DRAFT' | 'LIVE'; claim: 'UNCLAIMED' | 'PENDING' | null; mine: boolean; exact: boolean }
export interface MyPage extends CreatedPage { ref: PageRef; name: string; kind: PageKind; status: 'DRAFT' | 'LIVE'; role: string | null; crestUrl: string | null }
export interface Pitch { id: string; name: string; town: string; latitude: number; longitude: number; address: string; surface: Surface; size: PitchSize; lights: boolean; indoor: boolean; venueId: number | null; distanceKm: number }
export interface Arrival { id: number; childFirstName: string; childLastName: string; birthYear: number; squadId: number; squadName: string | null; guardianName: string; at: string }
export interface JoinLink { code: string; page: { ref: PageRef; name: string; town: string; crestUrl: string | null; profilePath: string; live: boolean }; squad: { id: number; name: string; ageGroup: string; gender: Gender } }
export interface InviteLink { code: string; role: StaffRole; status: 'INVITED' | 'JOINED'; squad: { id: number; name: string | null } | null; page: JoinLink['page'] }

/** What creating sends: the backend's setup request, with the page kind. */
export interface CreateRequest {
  requestId: string; displayName: string; pageKind: PageKind; organizationType: string; clubCategory: string | null;
  venueEnabled: false; /** On for an organiser set up from the Draw room. */ tournamentEnabled: boolean;
  location: { latitude: number | null; longitude: number | null; city: string } | null;
  /** The owner's language: the About written for them is in it. */
  language: 'en' | 'ka';
}

/** A save that lost the race: someone changed the same thing first. The page as it is now comes with it. */
export class PageConflict extends Error {
  readonly current: PageView;
  constructor(current: PageView) { super('Someone just changed this.'); this.current = current; }
}
const conflictOr = (error: unknown): never => {
  const response = (error as { response?: { status?: number; data?: { code?: string; page?: PageView } } }).response;
  if (response?.status === 409 && response.data?.code === 'VERSION_CONFLICT' && response.data.page) throw new PageConflict(response.data.page);
  throw error;
};

export const createPage = (body: CreateRequest) => apiClient.post<CreatedPage>('/organizations/setup', body).then(r => r.data);
/** Whether an answer is a page at all: a backend without pages answers something else for an organisation. */
export const isPageView = (value: unknown): value is PageView => Boolean(value) && typeof value === 'object' && 'kind' in (value as object) && 'identity' in (value as object) && 'boxes' in (value as object);
export const fetchPage = (ref: PageRef, signal?: AbortSignal) => apiClient.get<PageView>(pageBase(ref), { signal }).then(r => r.data);
export const saveIdentity = (ref: PageRef, version: number, patch: Partial<Omit<PageIdentity, 'version' | 'crest' | 'cover' | 'town'>> & { crest?: unknown; cover?: unknown; town?: { name: string } }) =>
  apiClient.put<PageView>(`${pageBase(ref)}/identity`, { version, ...patch }).then(r => r.data, conflictOr);
export const saveBox = <K extends SavableBox>(ref: PageRef, key: K, version: number, data: unknown) =>
  apiClient.put<PageView>(`${pageBase(ref)}/boxes/${key}`, { version, data }).then(r => r.data, conflictOr);
export const saveLayout = (ref: PageRef, version: number, layout: PageLayout) =>
  apiClient.put<PageView>(`${pageBase(ref)}/layout`, { version, ...layout }).then(r => r.data, conflictOr);
export const goLive = (ref: PageRef, requestId: string) => apiClient.post<PageView>(`${pageBase(ref)}/live`, { requestId }).then(r => r.data);
export const claimPage = (ref: PageRef, body: { requestId: string; role: string; phone: string }) => apiClient.post<PageView>(`${pageBase(ref)}/claim`, body).then(r => r.data);
export const requestVerification = (ref: PageRef, body: { action: LockedAction; legalName?: string; registrationNumber?: string; phone?: string }) =>
  apiClient.post<PageView>(`${pageBase(ref)}/verification`, body).then(r => r.data);

export const fetchSimilar = (name: string, town: string | null, signal?: AbortSignal) =>
  apiClient.get<SimilarPage[]>('/pages/similar', { params: { name, town: town ?? undefined }, signal }).then(r => r.data);
export const fetchMyPages = (signal?: AbortSignal) => apiClient.get<MyPage[]>('/pages/mine', { signal }).then(r => r.data);
export const fetchEligibility = (signal?: AbortSignal) =>
  apiClient.get<{ age: number | null; kinds: { kind: PageKind; allowed: boolean; minimumAge: number }[] }>('/pages/eligibility', { signal }).then(r => r.data);
export const fetchPitches = (latitude: number, longitude: number, radiusKm = 25, signal?: AbortSignal) =>
  apiClient.get<Pitch[]>('/pitches', { params: { lat: latitude, lng: longitude, radiusKm }, signal }).then(r => r.data);
export const reverseGeocode = (latitude: number, longitude: number) =>
  apiClient.get<{ address: string | null; town: string | null }>('/map/reverse', { params: { lat: latitude, lng: longitude } }).then(r => r.data);

export const fetchArrivals = (ref: PageRef, signal?: AbortSignal) => apiClient.get<Arrival[]>(`${pageBase(ref)}/arrivals`, { signal }).then(r => r.data);
export const decideArrival = (ref: PageRef, id: number, action: 'APPROVE' | 'DECLINE', squadId?: number) =>
  apiClient.post<PageView>(`${pageBase(ref)}/arrivals/${id}`, { action, squadId }).then(r => r.data);
export const pastePlayers = (ref: PageRef, squadId: number, names: string[]) => apiClient.post<PageView>(`${pageBase(ref)}/players`, { squadId, names }).then(r => r.data);
export const fetchJoinLink = (code: string, signal?: AbortSignal) => apiClient.get<JoinLink>(`/join/${encodeURIComponent(code)}`, { signal }).then(r => r.data);
/** `playerId`: a child the parent already looks after (the server checks the card is theirs and joins that card). */
export const sendJoin = (code: string, body: { childFirstName: string; childLastName: string; childGender: 'MALE' | 'FEMALE' | null; birthDate: string; consent: true; playerId?: number }) =>
  apiClient.post<{ id: number; status: string; squadName: string | null }>(`/join/${encodeURIComponent(code)}`, body).then(r => r.data);
export const fetchInvite = (code: string, signal?: AbortSignal) => apiClient.get<InviteLink>(`/invite/${encodeURIComponent(code)}`, { signal }).then(r => r.data);
export const acceptInvite = (code: string) => apiClient.post<{ profilePath: string }>(`/invite/${encodeURIComponent(code)}/accept`).then(r => r.data);
