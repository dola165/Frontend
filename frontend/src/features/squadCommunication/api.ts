import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import type { AuthSessionId } from '../../utils/authStorage';
import type { VenueReservationSummaryValue } from '../eventVenues/VenueReservationSummary';
import type { DayOfWeek, ScheduleEventType } from '../schedule/api';

export interface SquadEventPlan {
    requestId: string; title: string; eventType: ScheduleEventType; description: string | null;
    startsAt: string; endsAt: string; location: string | null; timezone: string;
    playerIds: number[]; requestResponses: boolean;
    repeat: { endDate: string; intervalWeeks: number; daysOfWeek: DayOfWeek[] } | null;
}
export interface SquadEventPreview {
    occurrences: { startsAt: string; endsAt: string }[]; participantCount: number;
    notificationRecipients: number; conflictingOccurrences: number; requestResponses: boolean;
}
export type SeriesScope = 'THIS' | 'FOLLOWING' | 'ALL_FUTURE';
export interface ExpectedSession { id: number; revision: number }
export interface SeriesPreview { expected: ExpectedSession[]; eventCount: number; notificationDeliveries: number; affectedResponses: number; dates: string[] }
export interface SeriesChange { change: SessionChange; scope: SeriesScope; expected?: ExpectedSession[] }
export interface SeriesCancellation { cancellation: { requestId: string; revision: number; reason: string }; scope: SeriesScope; expected?: ExpectedSession[] }
export const previewSeriesChange = async (squad: number, session: number, data: SeriesChange) => (await apiClient.post<SeriesPreview>(`/squad-communication/${squad}/events/${session}/changes/preview`,data)).data;
export const changeSeries = async (squad: number, session: number, data: SeriesChange) => apiClient.post(`/squad-communication/${squad}/events/${session}/changes`,data);
export const previewSeriesCancellation = async (squad: number, session: number, data: SeriesCancellation) => (await apiClient.post<SeriesPreview>(`/squad-communication/${squad}/events/${session}/cancellations/preview`,data)).data;
export const cancelSeries = async (squad: number, session: number, data: SeriesCancellation) => apiClient.post(`/squad-communication/${squad}/events/${session}/cancellations`,data);
export const previewSquadEvent = async (id: number, plan: SquadEventPlan, signal?: AbortSignal) =>
    (await apiClient.post<SquadEventPreview>(`/squad-communication/${id}/events/preview`, plan, { signal })).data;
export const createSquadEvent = async (id: number, plan: SquadEventPlan) =>
    (await apiClient.post<{ planId: string; sessionIds: number[] }>(`/squad-communication/${id}/events`, plan)).data;

export interface SquadSpace { id:number; club_id:number; academy_name:string; name:string; category:string; can_manage:boolean; unread_count:number }
export interface Person { id:number; name:string }
export interface IntroductoryVisitor { participationId:number;caseId:number;playerId:number;caseVersion:number;participationVersion:number;name:string;status:string;permissionStatus:string;emergencyContact:string|null;canRecord:boolean }
export interface VisitorAttendanceCommand {requestId:string;caseId:number;caseVersion:number;participationVersion:number;sessionRevision:number;attendance:'ATTENDED'|'NO_SHOW'}
export interface IntroductoryVisitorRegister {sessionRevision:number;visitors:IntroductoryVisitor[]}
export const introductoryVisitors=async(squad:number,session:number,signal?:AbortSignal)=>(await apiClient.get<IntroductoryVisitorRegister>(`/squad-communication/${squad}/sessions/${session}/introductory-visitors`,{signal})).data;
export const recordVisitorAttendance=async(squad:number,session:number,participation:number,command:VisitorAttendanceCommand,authSessionId:AuthSessionId)=>(await apiClient.put<IntroductoryVisitor>(`/squad-communication/${squad}/sessions/${session}/introductory-visitors/${participation}/attendance`,command,{_authSessionId:authSessionId} as AuthSessionRequestConfig)).data;
export interface SquadOverview extends SquadSpace { viewer_id:number; member_count:number; notify_chat:boolean; head_coach_id:number|null;can_assign_coach:boolean;available_coaches:{user_id:number;full_name:string}[];coaches:{user_id:number;full_name:string}[]; players:Person[]; threads:{user_id:number;full_name:string;unread_count:number}[];attention?:{upcoming_sessions:number;replies_needed:number;acknowledgements_needed:number} }
export interface SquadMessage { id:number;author_id:number;author_name:string;thread_user_id:number|null;kind:'CHAT'|'ANNOUNCEMENT';title:string|null;body:string;important:boolean;created_at:string;acknowledgement_requested:boolean;acknowledged_at:string|null; acknowledged_by?:Receipt[]; reactions?:UpdateReaction[]; comment_count?:number }
export type ReactionKind='LIKE'|'DISLIKE'|'LAUGH'|'CELEBRATE'|'CONFUSED'|'HEART'|'ROCKET'|'EYES';
export interface UpdateReaction {user_id:number;full_name:string;reaction:ReactionKind}
export interface UpdateComment {id:number;author_id:number;author_name:string;body:string;created_at:string}
export interface SquadSession { introductory_visitors?:IntroductoryVisitor[];event_type?:ScheduleEventType;description?:string|null;response_requested?:boolean;series_id?:string|null;id:number;title:string;starts_at:string;ends_at:string;location:string|null;status:'SCHEDULED'|'CANCELLED';cancellation_reason:string|null;revision:number;response_revision?:number;response_kind?:'INTENT';attendance:(Person&{response:string;active?:boolean;response_status?:string;response_valid?:boolean;previous_response?:string|null;recorded_by?:'PLAYER'|'GUARDIAN'|'COACH'|null;responded_at?:string|null})[];venue_reservation?:VenueReservationSummaryValue|null }
export interface SessionChange {eventType?:ScheduleEventType;description?:string;requestResponses?:boolean;requestId:string;revision:number;title:string;startsAt:string;endsAt:string;location:string;playerIds:number[]|null}
export interface SessionConsequence {revision:number;material:boolean;responsePolicy:'PRESERVE'|'RECONFIRM'|'INVALIDATE';affectedParticipants:number;affectedResponses:number;addedParticipants:number;removedParticipants:number;notificationRecipients:number}
export interface Receipt {user_id:number;full_name:string;acknowledged_at:string|null}
const root='/squad-communication';
export const spaces=async(signal?:AbortSignal)=>(await apiClient.get<SquadSpace[]>(root,{signal})).data;
export const overview=async(id:number,signal?:AbortSignal)=>(await apiClient.get<SquadOverview>(`${root}/${id}`,{signal})).data;
export const messages=async(id:number,kind:string,threadUserId:number|null,signal?:AbortSignal,before?:number)=>(await apiClient.get<SquadMessage[]>(`${root}/${id}/messages`,{params:{kind,threadUserId,before},signal})).data;
export const sessions=async(id:number,signal?:AbortSignal,window?:{from:string;to:string;playerId?:number})=>(await apiClient.get<SquadSession[]>(`${root}/${id}/sessions`,{signal,params:window})).data;
export const postMessage=async(id:number,data:{requestId:string;threadUserId:number|null;kind:string;title:string|null;body:string;important:boolean})=>apiClient.post(`${root}/${id}/messages`,data);
export const markRead=async(id:number,messageId:number,threadUserId:number|null)=>apiClient.post(`${root}/${id}/read`,{messageId,threadUserId});
export const acknowledge=async(id:number,messageId:number)=>apiClient.post(`${root}/${id}/messages/${messageId}/acknowledge`);
export const removeMessage=async(id:number,messageId:number)=>apiClient.delete(`${root}/${id}/messages/${messageId}`);
export const receipts=async(id:number,messageId:number)=>(await apiClient.get<Receipt[]>(`${root}/${id}/messages/${messageId}/receipts`)).data;
export const setReaction=async(id:number,messageId:number,reaction:ReactionKind,active:boolean)=>apiClient.put(`${root}/${id}/messages/${messageId}/reactions`,{reaction,active});
export const updateComments=async(id:number,messageId:number,signal?:AbortSignal,before?:number)=>(await apiClient.get<UpdateComment[]>(`${root}/${id}/messages/${messageId}/comments`,{signal,params:{before}})).data;
export const addUpdateComment=async(id:number,messageId:number,requestId:string,body:string)=>apiClient.post(`${root}/${id}/messages/${messageId}/comments`,{requestId,body});
export const removeUpdateComment=async(id:number,messageId:number,commentId:number)=>apiClient.delete(`${root}/${id}/messages/${messageId}/comments/${commentId}`);
export const setChatNotifications=async(id:number,notifyChat:boolean)=>apiClient.put(`${root}/${id}/preferences`,{notifyChat});
export const assignCoach=async(id:number,userId:number|null)=>apiClient.put(`${root}/${id}/coach`,{userId});
export const createSession=async(id:number,data:{requestId:string;title:string;startsAt:string;endsAt:string;location:string})=>apiClient.post(`${root}/${id}/sessions`,data);
export const cancelSession=async(id:number,sessionId:number,revision:number,reason:string,requestId:string)=>apiClient.post(`${root}/${id}/sessions/${sessionId}/cancel`,{requestId,revision,reason});
export const previewCancellation=async(id:number,sessionId:number,revision:number,reason:string,requestId:string)=>(await apiClient.post<SessionConsequence>(`${root}/${id}/sessions/${sessionId}/cancel/preview`,{requestId,revision,reason})).data;
export const previewSession=async(id:number,sessionId:number,data:SessionChange)=>(await apiClient.post<SessionConsequence>(`${root}/${id}/sessions/${sessionId}/preview`,data)).data;
export const editSession=async(id:number,sessionId:number,data:SessionChange)=>apiClient.put(`${root}/${id}/sessions/${sessionId}`,data);
export const attendance=async(id:number,sessionId:number,playerId:number,response:string,revision:number,requestId:string,authSessionId?:AuthSessionId)=>{
    const url=`${root}/${id}/sessions/${sessionId}/attendance`, command={playerId,response,revision,requestId};
    return authSessionId === undefined ? apiClient.put(url,command)
        : apiClient.put(url,command,{_authSessionId:authSessionId} as AuthSessionRequestConfig);
};
