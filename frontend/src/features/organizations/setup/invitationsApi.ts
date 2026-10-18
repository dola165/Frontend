import { apiClient } from '../../../api/axiosConfig';

export interface Invitation {
  id: number; organizationId: number; organizationName: string; recipientName?: string | null;
  role: string; status: string; canRespond?: boolean; canDecline?: boolean; recipient?: boolean;
  kind: 'team' | 'venue'; canOpenWorkspace?: boolean; workspacePath?: string;
}
export interface Team {
  members: { id: number; userId: number; name: string | null; role: string; canRemove: boolean }[];
  invitations: Invitation[]; canInviteAdmin: boolean;
}
export const getTeam = (id: number, signal?: AbortSignal) => apiClient.get<Team>(`/organizations/${id}/team`, { signal }).then(r => r.data);
export const updateTeam = (id: number, path: string, payload?: object) => apiClient.post<Team>(`/organizations/${id}/team/${path}`, payload).then(r => r.data);
export const getInvitationReceipt = (id: string, signal: AbortSignal) => apiClient.get<Invitation>(`/organizations/invitation-notices/${id}`, { signal }).then(r => ({ ...r.data, kind: r.data.role === 'VENUE_OPERATOR' ? 'venue' as const : 'team' as const }));
export const getTeamInvitations = (signal: AbortSignal) => apiClient.get<Invitation[]>('/organizations/team-invitations/mine', { signal }).then(r => r.data.map(v => ({ ...v, kind: 'team' as const })));
export const getVenueInvitations = (signal: AbortSignal) => apiClient.get<Invitation[]>('/organizations/invitations/mine', { signal }).then(r => r.data.map(v => ({ ...v, role: 'VENUE_OPERATOR', kind: 'venue' as const })));
export const respondToOrganizationInvitation = (invitation: Invitation, action: 'ACCEPT' | 'DECLINE') => apiClient.post(`/organizations/${invitation.kind === 'venue' ? 'invitations' : 'team-invitations'}/${invitation.id}/response`, { action });

export interface InvitationDraft { email: string; role: string; requestId: string }
export function readInvitationDraft(key: string): InvitationDraft | null {
  try { const value = JSON.parse(sessionStorage.getItem(key) ?? 'null'); return typeof value?.email === 'string' && typeof value?.role === 'string' && typeof value?.requestId === 'string' ? value : null; } catch { return null; }
}
export function saveInvitationDraft(key: string, draft: InvitationDraft | null) {
  try { if (draft) sessionStorage.setItem(key, JSON.stringify(draft)); else sessionStorage.removeItem(key); } catch { /* In-memory retries still use the original command. */ }
}
