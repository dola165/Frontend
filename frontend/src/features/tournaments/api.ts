import { apiClient } from '../../api/axiosConfig';
import type {
    AddDraftTeamFakeMemberPayload,
    AddDraftTeamMembersPayload,
    ClubSearchResult,
    CompleteFixturePayload,
    CreateDraftTeamPayload,
    CreateFixturePayload,
    CreateOrganizationPayload,
    CreateStagePayload,
    CreateTournamentInvitationPayload,
    CreateTournamentPayload,
    DraftTeamDetailDto,
    DraftTeamDto,
    GroupStandingsRow,
    MoveEntryPayload,
    MyOrganization,
    PageResult,
    ReplaceEntryPayload,
    RequestTournamentEntryPayload,
    TournamentDetail,
    TournamentHostClubOption,
    TournamentInvitationDto,
    TournamentSummary,
    UpdateEntryStatusPayload,
    UpdateDraftTeamPayload,
    UpdateEntrySquadPayload,
    UpdateFixtureParticipantsPayload,
    UpdateFixtureScoresPayload,
    UpdateSeedingPayload,
    UpdateTournamentPayload,
    UserSearchResult,
} from './domain';

export const fetchMyOrganizations = async () => {
    const response = await apiClient.get<MyOrganization[]>('/organizations/mine');
    return response.data;
};

export const createOrganization = async (payload: CreateOrganizationPayload) => {
    const response = await apiClient.post<MyOrganization>('/organizations', payload);
    return response.data;
};

export const fetchTournamentHostClubs = async (organizationId: number) => {
    const response = await apiClient.get<TournamentHostClubOption[]>(`/organizations/${organizationId}/tournament-host-clubs`);
    return response.data;
};

export const createTournament = async (payload: CreateTournamentPayload) => {
    const response = await apiClient.post<TournamentDetail>('/tournaments', payload);
    return response.data;
};

export const fetchTournament = async (tournamentId: number) => {
    const response = await apiClient.get<TournamentDetail>(`/tournaments/${tournamentId}`);
    return response.data;
};

export const registerPlayer = async (tournamentId: number) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/register-player`, {});
    return response.data;
};

export const fetchPlayerQueue = async (tournamentId: number, status: string = 'ACTIVE', page: number = 0, size: number = 20) => {
    const response = await apiClient.get<TournamentDetail>(`/tournaments/${tournamentId}/player-queue`, {
        params: { status, page, size },
    });
    return response.data;
};

export const requestEntry = async (tournamentId: number, payload: RequestTournamentEntryPayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/entries`, payload);
    return response.data;
};

export const updateEntryStatus = async (tournamentId: number, entryId: number, payload: UpdateEntryStatusPayload) => {
    const response = await apiClient.patch<TournamentDetail>(`/tournaments/${tournamentId}/entries/${entryId}/status`, payload);
    return response.data;
};

export const updateEntrySquad = async (tournamentId: number, entryId: number, payload: UpdateEntrySquadPayload) => {
    const response = await apiClient.patch<TournamentDetail>(`/tournaments/${tournamentId}/entries/${entryId}/squad`, payload);
    return response.data;
};

export const createDraftTeam = async (tournamentId: number, payload: CreateDraftTeamPayload) => {
    const response = await apiClient.post<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams`, payload);
    return response.data;
};

export const fetchDraftTeams = async (tournamentId: number) => {
    const response = await apiClient.get<DraftTeamDto[]>(`/tournaments/${tournamentId}/draft-teams`);
    return response.data;
};

export const fetchDraftTeam = async (tournamentId: number, teamId: number) => {
    const response = await apiClient.get<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}`);
    return response.data;
};

export const updateDraftTeam = async (tournamentId: number, teamId: number, payload: UpdateDraftTeamPayload) => {
    const response = await apiClient.patch<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}`, payload);
    return response.data;
};

export const addDraftTeamMembers = async (tournamentId: number, teamId: number, payload: AddDraftTeamMembersPayload) => {
    const response = await apiClient.post<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}/members`, payload);
    return response.data;
};

export const removeDraftTeamMember = async (tournamentId: number, teamId: number, entryId: number) => {
    const response = await apiClient.delete<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}/members/${entryId}`);
    return response.data;
};

export const addDraftTeamFakeMember = async (tournamentId: number, teamId: number, payload: AddDraftTeamFakeMemberPayload) => {
    const response = await apiClient.post<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}/fake-members`, payload);
    return response.data;
};

export const removeDraftTeamFakeMember = async (tournamentId: number, teamId: number, memberId: number) => {
    const response = await apiClient.delete<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}/fake-members/${memberId}`);
    return response.data;
};

export const promoteDraftTeam = async (tournamentId: number, teamId: number) => {
    const response = await apiClient.post<DraftTeamDetailDto>(`/tournaments/${tournamentId}/draft-teams/${teamId}/promote`);
    return response.data;
};

export const disbandDraftTeam = async (tournamentId: number, teamId: number) => {
    await apiClient.delete(`/tournaments/${tournamentId}/draft-teams/${teamId}`);
};

export const completeFixture = async (tournamentId: number, fixtureId: number, payload: CompleteFixturePayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/complete`, payload);
    return response.data;
};

export const cancelFixture = async (tournamentId: number, fixtureId: number) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/cancel`);
    return response.data;
};

export const updateFixtureScores = async (tournamentId: number, fixtureId: number, payload: UpdateFixtureScoresPayload) => {
    const response = await apiClient.patch<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/scores`, payload);
    return response.data;
};

export const reopenFixture = async (tournamentId: number, fixtureId: number) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/reopen`);
    return response.data;
};

export const fetchTournaments = async (params?: { page?: number; size?: number; scope?: string; visibility?: string; status?: string }) => {
    const response = await apiClient.get<PageResult<TournamentSummary>>('/tournaments', { params });
    return response.data;
};

export const fetchTournamentInvitations = async (tournamentId: number) => {
    const response = await apiClient.get<TournamentInvitationDto[]>(`/tournaments/${tournamentId}/invitations`);
    return response.data;
};

export const createTournamentInvitation = async (tournamentId: number, payload: CreateTournamentInvitationPayload) => {
    const response = await apiClient.post<TournamentInvitationDto>(`/tournaments/${tournamentId}/invitations`, payload);
    return response.data;
};

export const cancelTournamentInvitation = async (tournamentId: number, invitationId: number) => {
    await apiClient.delete(`/tournaments/${tournamentId}/invitations/${invitationId}`);
};

export const searchClubsForInvite = async (query: string) => {
    if (!query.trim()) return [] as ClubSearchResult[];
    const response = await apiClient.get<ClubSearchResult[]>('/clubs/search', { params: { q: query.trim(), limit: 10 } });
    return response.data;
};

export const searchPlayersForInvite = async (query: string) => {
    if (!query.trim()) return [] as UserSearchResult[];
    const response = await apiClient.get<{ content: UserSearchResult[] }>('/users/search', { params: { query: query.trim(), size: 10 } });
    return response.data.content ?? (Array.isArray(response.data) ? response.data : []);
};

export const updateTournament = async (tournamentId: number, payload: UpdateTournamentPayload) => {
    const response = await apiClient.patch<TournamentDetail>(`/tournaments/${tournamentId}`, payload);
    return response.data;
};

export const removeEntry = async (tournamentId: number, entryId: number) => {
    await apiClient.delete(`/tournaments/${tournamentId}/entries/${entryId}`);
};

export const createStage = async (tournamentId: number, payload: CreateStagePayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/stages`, payload);
    return response.data;
};

export const createFixture = async (tournamentId: number, stageId: number, payload: CreateFixturePayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/stages/${stageId}/fixtures`, payload);
    return response.data;
};

export const randomizeStageBracket = async (tournamentId: number, stageId: number) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/stages/${stageId}/fixtures/randomize`);
    return response.data;
};

export const fetchGroupStandings = async (tournamentId: number, stageId: number) => {
    const response = await apiClient.get<GroupStandingsRow[]>(`/tournaments/${tournamentId}/stages/${stageId}/standings`);
    return response.data;
};

export const updateSeeding = async (tournamentId: number, payload: UpdateSeedingPayload) => {
    const response = await apiClient.put<TournamentDetail>(`/tournaments/${tournamentId}/entries/seeding`, payload);
    return response.data;
};

export const updateFixtureParticipants = async (tournamentId: number, fixtureId: number, payload: UpdateFixtureParticipantsPayload) => {
    const response = await apiClient.patch<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/participants`, payload);
    return response.data;
};

export const moveEntry = async (tournamentId: number, fixtureId: number, payload: MoveEntryPayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/move-entry`, payload);
    return response.data;
};

export const replaceEntry = async (tournamentId: number, fixtureId: number, payload: ReplaceEntryPayload) => {
    const response = await apiClient.post<TournamentDetail>(`/tournaments/${tournamentId}/fixtures/${fixtureId}/replace-entry`, payload);
    return response.data;
};
