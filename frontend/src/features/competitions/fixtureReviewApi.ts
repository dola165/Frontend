import { apiClient } from '../../api/axiosConfig';
import type { TournamentDetail } from '../tournaments/domain';

export interface Concern {
  id: number; entryId: number; status: 'PENDING' | 'CORRECTED' | 'REJECTED'; version: number; reason: string;
  history: { action: string; reason: string; at: string }[];
}
export interface FixtureConcerns {
  revision: number; resultRevision: number; canRaise: boolean; canReview: boolean;
  entries: { id: number; label: string }[]; concerns: Concern[];
}
export interface QualificationRepair { revision: number; available: boolean; paused: boolean; sourceStageId: number; fixtureIds: number[] }
export const getFixtureConcerns = async (id: number, fixture: number, signal: AbortSignal) =>
  (await apiClient.get<FixtureConcerns>(`/competitions/${id}/fixtures/${fixture}/concerns`, { signal })).data;
export const concernCommand = async (id: number, path: string, body: unknown) =>
  (await apiClient.post<FixtureConcerns>(`/competitions/${id}/${path}`, body)).data;
export const getQualificationRepair = async (id: number, fixture: number, signal: AbortSignal) =>
  (await apiClient.get<QualificationRepair>(`/competitions/${id}/fixtures/${fixture}/qualification-repair`, { signal })).data;
export const repairQualification = async (id: number, path: string, body: unknown) =>
  (await apiClient.post<TournamentDetail>(`/competitions/${id}/${path}`, body)).data;
