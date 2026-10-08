import { apiClient } from '../../api/axiosConfig';

export interface TournamentDivision { id: number; tournamentId: number; name: string; tournamentName: string; status: string; visibility: string; startDate: string; endDate: string }
export interface TournamentEdition { id: number; label: string; startDate: string; endDate: string; divisions: TournamentDivision[] }
export interface TournamentSeries { id: number; organizerOrganizationId: number; name: string; description: string | null; canManage: boolean; editions: TournamentEdition[] }
export interface NewSeries { name: string; description?: string; editionLabel: string; divisionName: string }
export interface NewEdition { label: string; startDate: string; endDate: string }
export const updateTournamentSeries = async (seriesId: number, body: { name: string; description: string }) => (await apiClient.patch<TournamentSeries>(`/tournament-series/${seriesId}`, body)).data;
export const updateTournamentEdition = async (seriesId: number, editionId: number, body: NewEdition) => (await apiClient.patch<TournamentSeries>(`/tournament-series/${seriesId}/editions/${editionId}`, body)).data;
export const fetchTournamentSeries = async (id: number): Promise<TournamentSeries | null> => (await apiClient.get<TournamentSeries | null>(`/tournament-series/by-tournament/${id}`)).data || null;
export const createTournamentSeries = async (id: number, body: NewSeries) => (await apiClient.post<TournamentSeries>(`/tournament-series/from-tournament/${id}`, body)).data;
export const createNextEdition = async (seriesId: number, editionId: number, body: NewEdition) => (await apiClient.post<TournamentSeries>(`/tournament-series/${seriesId}/editions/${editionId}/next`, body)).data;
export const createTournamentDivision = async (seriesId: number, editionId: number, body: { name: string; templateTournamentId: number }) => (await apiClient.post<TournamentSeries>(`/tournament-series/${seriesId}/editions/${editionId}/divisions`, body)).data;
export const attachTournamentDivision = async (seriesId: number, editionId: number, body: { name: string; tournamentId: number }) => (await apiClient.post<TournamentSeries>(`/tournament-series/${seriesId}/editions/${editionId}/attach`, body)).data;
