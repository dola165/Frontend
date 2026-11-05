import { apiClient, type AuthSessionRequestConfig } from '../../../api/axiosConfig';
import { assertCurrentAuthSession, type AuthSessionId } from '../../../utils/authStorage';

export type HandoffTarget = 'FINANCE' | 'EQUIPMENT';
export interface HandoffScope { clubId: number; actorId: number; caseId: number; caseVersion: number; sessionId: AuthSessionId }
export interface HandoffOverview {
    actorId: number; clubId: number; caseId: number; caseVersion: number;
    actions: { target: HandoffTarget; canStart: boolean; receivers: { id: number; name: string }[] }[];
}
export interface HandoffContext {
    actorId: number; clubId: number; caseId: number; caseVersion: number; playerId: number; playerName: string;
    squadId: number; squadName: string; offerId: number; target: HandoffTarget; startDate: string; endDate: string | null;
    feesKnown: boolean; charges: { label: string; amount: number; currency: string; frequency: string }[];
    records: { id: number; status: string }[];
}
export interface HandoffRecord {
    kind: 'INSTALMENT' | 'EQUIPMENT_ISSUE'; title: string; squadId: number; subjectUserId: number;
    relatedRecordId: number | null; assignedUserId: null; eventId: null; sessionId: null; dueOn: string | null;
    revision: null; data: Record<string, string>;
}
export interface HandoffCreated { actorId: number; clubId: number; caseId: number; recordId: number }
const root = (scope: HandoffScope) => `/clubs/${scope.clubId}/admissions/cases/${scope.caseId}/handoff`;
export function checkHandoffScope(scope: HandoffScope, value: Pick<HandoffOverview, 'actorId' | 'clubId' | 'caseId'> & { caseVersion?: number }) {
    assertCurrentAuthSession(scope.sessionId);
    if (value.actorId !== scope.actorId || value.clubId !== scope.clubId || value.caseId !== scope.caseId || value.caseVersion !== undefined && value.caseVersion !== scope.caseVersion)
        throw new Error('The admission context changed. Refresh and review it again.');
}
export async function loadHandoff<T extends HandoffOverview | HandoffContext>(scope: HandoffScope, signal: AbortSignal, target?: HandoffTarget): Promise<T> {
    assertCurrentAuthSession(scope.sessionId);
    const config: AuthSessionRequestConfig = { signal, _authSessionId: scope.sessionId, params: target ? { expectedVersion: scope.caseVersion } : undefined };
    const value = (await apiClient.get<T>(root(scope) + (target ? `/${target}` : ''), config)).data;
    checkHandoffScope(scope, value);
    if (target && (!('target' in value) || value.target !== target)) throw new Error('The receiving action changed. Refresh and review it again.');
    return value;
}
export async function createHandoffRecord(scope: HandoffScope, target: HandoffTarget, record: HandoffRecord, key: string) {
    assertCurrentAuthSession(scope.sessionId);
    const config: AuthSessionRequestConfig = { _authSessionId: scope.sessionId, headers: { 'Idempotency-Key': key } };
    const value = (await apiClient.post<HandoffCreated>(`${root(scope)}/${target}`, { expectedVersion: scope.caseVersion, record },
        config)).data;
    checkHandoffScope(scope, value);
    return value;
}
