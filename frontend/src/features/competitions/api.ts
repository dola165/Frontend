import { apiClient } from '../../api/axiosConfig';
import type { CreateTournamentPayload, PageResult, TournamentDetail, TournamentStatus } from '../tournaments/domain';

export type Family = 'LEAGUE' | 'CUP' | 'LADDER' | 'FESTIVAL';
export type Structure = 'ROUND_ROBIN' | 'HOME_AWAY' | 'KNOCKOUT' | 'GROUPS_KNOCKOUT' | 'SWISS' | 'SPLIT_LEAGUE' | 'LADDER' | 'ROTATION' | 'KING_OF_PITCH';
export type Discipline = 'ASSOCIATION' | 'FUTSAL' | 'BEACH' | 'WALKING' | 'OTHER';
export type Tiebreak = 'POINTS' | 'GOAL_DIFFERENCE' | 'GOALS_FOR' | 'WINS' | 'BUCHHOLZ' | 'SEED';
export interface CompetitionRules {
  family: Family; structure: Structure; discipline: Discipline; sideSize: number;
  ageGroup: string; eligibilityCategory: string; playingLevel: string; country: string; city: string; timezone: string;
  ruleset: string; jurisdiction: string; ageCutoff: string | null; matchMinutes: number; restMinutes: number;
  pitches: number; rounds: number; tiebreaks: Tiebreak[]; challengeRange: number; challengeExpiryDays: number;
  maxConsecutiveStays: number; standings: boolean; entryFee: number; currency: string; feeBasis: 'TEAM' | 'PLAYER' | 'EVENT'; seasonPolicy: string;
}
export const structures: Record<Family, Structure[]> = { LEAGUE: ['ROUND_ROBIN','HOME_AWAY','SWISS','SPLIT_LEAGUE'], CUP: ['KNOCKOUT','GROUPS_KNOCKOUT','SWISS'], LADDER: ['LADDER'], FESTIVAL: ['ROTATION','KING_OF_PITCH'] };
export const familyLabels: Record<Family, string> = { LEAGUE: 'Leagues', CUP: 'Cups & Tournaments', LADDER: 'Ladders', FESTIVAL: 'Festivals' };
export const structureLabels: Record<Structure, string> = { ROUND_ROBIN: 'Round-robin', HOME_AWAY: 'Home & away', KNOCKOUT: 'Knockout', GROUPS_KNOCKOUT: 'Groups then knockout', SWISS: 'Swiss rounds', SPLIT_LEAGUE: 'Split league', LADDER: 'Challenge ladder', ROTATION: 'Development festival', KING_OF_PITCH: 'King of the Pitch' };
export const defaultRules = (family: Family = 'CUP'): CompetitionRules => ({ family, structure: structures[family][0], discipline:'ASSOCIATION',sideSize:11,ageGroup:'SENIOR',eligibilityCategory:'Open',playingLevel:'COMPETITIVE',country:'Georgia',city:'Tbilisi',timezone:'Asia/Tbilisi',ruleset:'',jurisdiction:'',ageCutoff:null,matchMinutes:90,restMinutes:30,pitches:1,rounds:3,tiebreaks:['POINTS','GOAL_DIFFERENCE','GOALS_FOR','SEED'],challengeRange:3,challengeExpiryDays:7,maxConsecutiveStays:2,standings:family!=='FESTIVAL',entryFee:0,currency:'GEL',feeBasis:'TEAM',seasonPolicy:'' });
export interface Profile { rules: CompetitionRules | null; revision: number; legacy: boolean }
export interface EligibilityPolicy { minimumRoster:number; maximumMatchMinutes:number; inactivityDays:number; minimumAge:number; ruleAuthority:string; sanctioningEvidence:string; allowParticipantOfficials?:boolean }
export const defaultPolicy=():EligibilityPolicy=>({minimumRoster:1,maximumMatchMinutes:120,inactivityDays:0,minimumAge:0,ruleAuthority:"Organiser's published competition rules",sanctioningEvidence:''});
export interface CompetitionCard { id: number; name: string; description: string | null; status: TournamentStatus; participantScope: string; organizerName: string | null; hostClubName: string | null; startDate: string; endDate: string; bannerImageUrl: string | null; entryCount: number; entryCap: number | null; profile: Profile }
export interface Standing { entryId: number; label: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number; buchholz: number; seed: number; rating: number; rank: number }
export interface Challenge { id: number; challenger_entry_id: number; target_entry_id: number; proposed_at: string; expires_at: string; venue: string; status: string; fixture_id: number | null }
export interface OperationsState { profile: Profile; standings: Standing[]; rounds: { round_number: number; bye_entry_id: number | null }[]; challenges: Challenge[]; controllableEntries: number[]; canOperate: boolean; canComplete: boolean; rankingStageId:number|null; rankContests:{entries:Standing[];fromRank:number}[]; policy:EligibilityPolicy|null; inactiveEntries:number[] }
export const browseCompetitions = async (params: URLSearchParams, signal: AbortSignal) => (await apiClient.get<PageResult<CompetitionCard>>(`/competitions?${params}`, { signal })).data;
export const getOperations = async (id: number, signal: AbortSignal) => (await apiClient.get<OperationsState>(`/competitions/${id}/operations`, { signal })).data;
export const getCompetitionProfile = async (id: number, signal?: AbortSignal) => (await apiClient.get<Profile>(`/competitions/${id}/rules`, { signal })).data;
export const browsePersonalCompetitions=async(params:{page:number;size:number;search?:string;scope?:string;status?:string})=>(await apiClient.get<PageResult<import('../tournaments/domain').TournamentSummary>>('/competitions/mine',{params})).data;
export const createCompetition = async (identity: CreateTournamentPayload, rules: CompetitionRules, requestId: string, policy?:EligibilityPolicy,venueId?:number|null) => (await apiClient.post<TournamentDetail>('/competitions', { identity,rules,requestId,policy,venueId })).data;
export const operation = async (id: number, path: string, body: unknown) => (await apiClient.post<OperationsState>(`/competitions/${id}/${path}`,body)).data;
export const saveRules = async (id: number, rules: CompetitionRules, revision: number, requestId: string) => (await apiClient.put<Profile>(`/competitions/${id}/rules`,{rules,revision,requestId})).data;
export interface DrawPlan { startsAt:string; daysBetweenRounds:number; groupCount:number; qualifiers:number; routes:number; thirdPlace:boolean; twoLegged:boolean; aggregateResolution:'PENALTIES'|'REPLAY'|'DRAW_LOTS'; carryResults:boolean; splitCut:number; divisionLinks:string }
export interface DrawState { plan:DrawPlan|null; transitioned:boolean; stages:{id:number;name:string;stage_type:string;phase:number;title_route:boolean;carry_results:boolean;standings?:Standing[];rankContests?:{entries:Standing[];fromRank:number}[]}[]; slots:{fixture_id:number;pitch_number:number;starts_at:string;ends_at:string}[]; routes:{target_fixture_id:number;slot:string;source_fixture_id:number;outcome:string}[]; aggregates:{deciding_fixture_id:number;first_fixture_id:number;replay_fixture_id:number|null;resolution:string;ready:boolean;tied:boolean;winner:number|null;homeEntryId?:number;awayEntryId?:number;homeAggregate?:number;awayAggregate?:number}[] }
export const getDraw = async(id:number,signal:AbortSignal)=>(await apiClient.get<DrawState>(`/competitions/${id}/draw`,{signal})).data;
export const drawOperation = async(id:number,path:string,body:unknown)=>(await apiClient.post<DrawState>(`/competitions/${id}/draw${path?`/${path}`:''}`,body)).data;
