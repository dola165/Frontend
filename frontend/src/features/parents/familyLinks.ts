import { apiClient } from '../../api/axiosConfig';

/**
 * Family links (owner, 2 November 2026: one child, one card). One link for any chat:
 * ADD_PARENT (a teen asks a parent), ANOTHER_PARENT (a guardian adds the child's other parent) and CLUB_CARD (the club
 * sends a player card to its family). Backend: `parents/links` (V440).
 */
export type FamilyLinkKind = 'ADD_PARENT' | 'ANOTHER_PARENT' | 'CLUB_CARD';

export interface FamilyLink { id: number; kind: FamilyLinkKind; code: string; path: string; expiresAt: string; personId: number; personName: string | null }

/** What a link asks, before signing in: first names only. `selfPossible`: the player may claim a club card as theirs. */
export interface FamilyLinkPreview {
    kind: FamilyLinkKind;
    state: 'ACTIVE' | 'CLAIMED' | 'EXPIRED' | 'REVOKED';
    personName: string;
    askedBy: string;
    clubId: number | null;
    clubName: string | null;
    clubLogoUrl: string | null;
    selfPossible: boolean;
    expiresAt: string;
}

export interface FamilyLinkClaim { as: 'PARENT' | 'SELF'; childId?: number | null; birthDate?: string | null; confirmed: true; askClub?: boolean }

/** LINKED: you are the parent now. JOINED: the card joined a child you hold (or your account). PROPOSED: the card's family was asked. ASKED_PARENT: the child's parent was asked to add you. ASKED_CLUB: the club's Owner and Admins were asked to confirm you. */
export interface FamilyLinkClaimed { outcome: 'LINKED' | 'JOINED' | 'PROPOSED' | 'ASKED_PARENT' | 'ASKED_CLUB'; personId: number; personName: string | null; mergeId: number | null }

export const addMyParentLink = () => apiClient.post<FamilyLink>('/auth/parent-approval/link').then(r => r.data);
export const anotherParentLink = (childId: number) => apiClient.post<FamilyLink>(`/family/children/${childId}/link`).then(r => r.data);
export const clubCardFamilyLink = (clubId: number, playerId: number) =>
    apiClient.post<FamilyLink>(`/clubs/${clubId}/players/${playerId}/family-link`).then(r => r.data);
export const previewFamilyLink = (code: string, signal?: AbortSignal) =>
    apiClient.get<FamilyLinkPreview>(`/family-links/${encodeURIComponent(code)}`, { signal }).then(r => r.data);
export const claimFamilyLink = (code: string, body: FamilyLinkClaim) =>
    apiClient.post<FamilyLinkClaimed>(`/family-links/${encodeURIComponent(code)}/claim`, body).then(r => r.data);
/** "Remind Mum": the teen's own offered place; 409 ADD_A_PARENT when nobody is their parent yet. */
/** "Not their parent": ends a link a family link made; the first answer counts (409 ALREADY_ANSWERED after it). */
export const notTheirParent = (guardianLink: number) => apiClient.post<void>(`/family/guardian-links/${guardianLink}/not-their-parent`).then(() => undefined);
/** Under a player's card: who claimed its family link, when and from where. With `askId` they asked the club to confirm them and aren't the parent yet. */
export interface ClaimedParent { guardianLinkId: number | null; name: string; claimedAt: string; claimedFrom: string | null; askId?: number | null; canAnswer?: boolean }
/** The club's ask to confirm someone as a player's parent; first names only. */
export interface ParentAsk { id: number; adultName: string; childName: string; clubName: string; status: 'WAITING' | 'YES' | 'NO'; answeredBy: string | null; canAnswer: boolean }
export const fetchParentAsk = (id: number, signal?: AbortSignal) => apiClient.get<ParentAsk>(`/family/parent-asks/${id}`, { signal }).then(r => r.data);
/** The first answer counts (409 ALREADY_ANSWERED after it). */
export const answerParentAsk = (id: number, yes: boolean) => apiClient.post<void>(`/family/parent-asks/${id}/answer`, { yes }).then(() => undefined);
export const fetchClaimedParents = (clubId: number, playerId: number, signal?: AbortSignal) =>
    apiClient.get<ClaimedParent[]>(`/clubs/${clubId}/players/${playerId}/family-link/claimed`, { signal }).then(r => r.data);
export const remindParents = (caseId: number) => apiClient.post<void>(`/family/me/cases/${caseId}/remind-parents`).then(() => undefined);

/** Two cards for one child: DONE (one card now, undoable until `undoUntil`), PROPOSED, DECLINED or UNDONE. */
export interface PersonMerge {
    id: number;
    status: 'PROPOSED' | 'DONE' | 'DECLINED' | 'UNDONE';
    source: 'FAMILY' | 'JOIN_APPROVAL' | 'CLUB_CARD_LINK';
    keptId: number;
    keptName: string | null;
    joinedId: number;
    joinedName: string | null;
    clubName: string | null;
    proposedByName: string | null;
    waitingForMe: boolean;
    undoUntil: string | null;
}

/** Two of my children who look like one child. */
export interface LookAlike { personId: number; personName: string; otherId: number; otherName: string }

export const fetchMerges = (signal?: AbortSignal) => apiClient.get<PersonMerge[]>('/person-merges', { signal }).then(r => r.data);
export const fetchLookAlikes = (signal?: AbortSignal) => apiClient.get<LookAlike[]>('/person-merges/look-alikes', { signal }).then(r => r.data);
export const joinCards = (personId: number, otherId: number, birthDate?: string | null) =>
    apiClient.post<PersonMerge>('/person-merges', { personId, otherId, birthDate: birthDate ?? null }).then(r => r.data);
export const answerMerge = (id: number, accept: boolean, birthDate?: string | null) =>
    apiClient.post<PersonMerge>(`/person-merges/${id}/answer`, { accept, birthDate: birthDate ?? null }).then(r => r.data);
export const undoMerge = (id: number) => apiClient.post<PersonMerge>(`/person-merges/${id}/undo`).then(r => r.data);
