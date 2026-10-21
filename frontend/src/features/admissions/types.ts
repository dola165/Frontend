import type { InquiryContinuation, InquirySetupCapability } from '../joining-contract/types';
/** Admissions contract 1.3.0. Dates are ISO, deadlines are authoritative UTC instants. */
export type AdmissionMethod = 'DIRECT' | 'INTRODUCTION' | 'SELECTIVE';
export type Availability = 'PLACES_AVAILABLE' | 'APPLICATIONS_OPEN' | 'INTRODUCTION_AVAILABLE' | 'UPCOMING_ASSESSMENT' | 'WAITLIST' | 'CLOSED';
export type CaseStage = 'REQUEST_RECEIVED' | 'ARRANGING_PARTICIPATION' | 'INTRODUCTION_ASSESSMENT' | 'WAITLIST' | 'PLACE_OFFERED' | 'COMPLETING_ENROLLMENT' | 'ENROLLED' | 'CLOSED';
export type AffiliationEffect = 'NONE' | 'PRIMARY_CHANGE';
export type RequirementKind = 'EMERGENCY_CONTACT' | 'SCHOOL_ELIGIBILITY' | 'CURRENT_CLUB_PERMISSION' | 'PAYMENT_CONFIRMATION' | 'EXTERNAL_REGISTRATION' | 'PRIMARY_AFFILIATION_CONFIRMATION' | 'GUARDIAN_REVIEW';
export type CaseAction = 'MESSAGE' | 'ASSIGN' | 'INVITE_SESSION' | 'CONFIRM_SESSION' | 'DECLINE_SESSION' | 'RECORD_ATTENDANCE' | 'CHANGE_SESSION' | 'CANCEL_SESSION' | 'OFFER' | 'ACCEPT_OFFER' | 'DECLINE_OFFER' | 'WITHDRAW_OFFER' | 'EXTEND_OFFER' | 'COMPLETE_REQUIREMENT' | 'WAITLIST' | 'DECLINE' | 'WITHDRAW' | 'CANCEL_ENROLLMENT' | 'CONFIRM_PRIMARY_CHANGE' | 'ASSESS' | 'RECOMMEND' | 'APPROVE_ADMISSION' | 'RECORD_INTRODUCTION_PERMISSION' | 'REVOKE_INTRODUCTION_PERMISSION';
export interface Choice { id: number; name: string }
export interface Participant extends Choice { dateOfBirth: string | null; minor: boolean; guardian: boolean; provenance: string | null; gender?: 'MALE' | 'FEMALE' | null; restriction?: 'REVIEW' | null }
export interface Charge { label: string; amount: number; currency: string; frequency: string }
export interface Terms {
  feesKnown: boolean; charges: Charge[]; cancellation: string; participation: string;
  startDate: string; endDate: string | null; affiliationEffect: AffiliationEffect;
  requirements: RequirementKind[];
}
export interface Location { name: string; address: string; latitude: number | null; longitude: number | null }
export interface IntroductionPermissionPolicy { required: boolean; reason: string }
export interface IntroductionPermissionState extends IntroductionPermissionPolicy { status: 'NOT_REQUIRED' | 'PENDING' | 'COMPLETE' | 'REVOKED' | 'STALE' | 'HISTORICAL_UNVERIFIED' | 'EXPIRED'; owner: 'CLUB'; evidence: string | null; currentClub: string | null; recordedAt: string | null; canRecord: boolean; canRevoke: boolean; allowsParticipation: boolean }
export interface GroupInput {
  requestId: string; expectedVersion: number; name: string; squadId: number | null;
  intake: string; method: AdmissionMethod; visibility: 'PUBLIC' | 'INVITATION_ONLY';
  published: boolean; intakeOpen: boolean; capacity: number; beginnerWelcome: boolean;
  birthYearFrom: number; birthYearTo: number; referenceDate: string; gender: 'ANY' | 'MALE' | 'FEMALE';
  location: Location; schedule: string; timezone: string; terms: Terms;
  responsibleUserId: number | null; waitlistEnabled: boolean;
  introductionPermission?: IntroductionPermissionPolicy | null;
  extraApprovalRequired?: boolean; decisionUserId?: number | null;
  city?: string; country?: string; level?: string; positions?: string[];
}
export interface Opportunity extends Omit<GroupInput, 'requestId' | 'expectedVersion'> {
  id: number; version: number; organizationId: number; organizationName: string; clubId: number | null;
  availability: Availability; remainingPlaces: number; destination: string; canManage?: boolean;
}
export interface OpportunityPage { items: Opportunity[]; total: number; page: number; size: number; hasMore: boolean }
export interface DiscoveryQuery {
  organizationId?: number; clubId?: number; birthYear?: number; gender?: 'MALE' | 'FEMALE';
  beginner?: boolean; acceptingOnly?: boolean; includeWaitlist?: boolean; method?: AdmissionMethod;
  q?: string; page?: number; size?: number;
  latitude?: number; longitude?: number; radiusKm?: number;
  minLat?: number; maxLat?: number; minLng?: number; maxLng?: number;
  country?: string[]; city?: string[]; level?: string; position?: string; category?: string[]; verifiedOnly?: boolean;
}
export interface Requirement { id: number; kind: RequirementKind; owner: 'APPLICANT' | 'CLUB' | 'REGISTRATION_STAFF'; status: 'PENDING' | 'COMPLETE'; evidence: string | null; canComplete?: boolean }
export interface NextAction { code: string; owner: 'APPLICANT' | 'CLUB' | 'REGISTRATION_STAFF' | 'PLATFORM' | 'NONE'; label: string; dueAt: string | null }
export interface SessionDetails {
  title: string; startsAt: string; endsAt: string; timezone: string; location: Location;
  contact: string; preparation: string; cost: string; capacity: number; responseDeadline: string;
  squadSessionId: number | null; noRegularPlaceGuaranteed: boolean;
}
export interface Participation extends SessionDetails {
  id: number; version: number; status: 'INVITED' | 'CONFIRMED' | 'RECONFIRM_REQUIRED' | 'DECLINED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  emergencyContact: string | null;
  introductionPermission?: IntroductionPermissionState;
}
export interface Offer {
  id: number; version: number; groupId: number; groupName: string; terms: Terms; location: Location; schedule: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'SUPERSEDED' | 'EXPIRED';
  responseDeadline: string; completionDeadline: string | null;
}
export interface Enrollment { id: number; groupId: number; groupName: string; startDate: string; endDate: string | null; status: 'ACTIVE' | 'CANCELLED'; matchEligibility: 'NOT_GRANTED'; scheduleDestination: string; squadId?: number | null; rosterDestination?: string }
export interface CaseEvent { id: number; action: string; message: string | null; actorName: string; createdAt: string }
export interface AdmissionCase {
  id: number; version: number; playerId: number; playerName: string; dateOfBirth: string;
  organizationId: number; organizationName: string; clubId: number | null; groupId: number;
  groupName: string; intake: string; method: AdmissionMethod; stage: CaseStage; responsible: Choice | null;
  nextAction: NextAction; requirements: Requirement[]; sessions: Participation[]; offer: Offer | null;
  enrollment: Enrollment | null; history: CaseEvent[]; actions: CaseAction[];
  primaryAffiliation: { clubId: number; clubName: string } | null;
  previousCaseId: number | null; submittedAt: string; updatedAt: string;
  assessments?: { id: number; kind: 'ASSESS' | 'RECOMMEND' | 'APPROVE_ADMISSION'; groupId: number; note: string | null; actorName: string; createdAt: string }[];
  siblingConstraint?: string | null;
}
export interface Submission {
  requestId: string; opportunityId: number; opportunityVersion: number; playerId: number;
  message?: string; siblingConstraint?: string; intent: 'REQUEST' | 'DIRECT_ENROLL' | 'WAITLIST';
  acceptTerms?: boolean; emergencyContact?: string;
}
export interface CommandBase { requestId: string; expectedVersion: number }
export type CaseCommand = CommandBase & (
  | { action: 'MESSAGE'; message: string }
  | { action: 'ASSIGN'; responsibleUserId: number | null }
  | { action: 'INVITE_SESSION'; session: SessionDetails }
  | { action: 'CHANGE_SESSION'; participationId: number; participationVersion: number; session: SessionDetails; reason: string }
  | { action: 'CONFIRM_SESSION'; participationId: number; participationVersion: number; acceptTerms: true; emergencyContact: string }
  | { action: 'DECLINE_SESSION' | 'CANCEL_SESSION'; participationId: number; participationVersion: number; reason: string }
  | { action: 'RECORD_ATTENDANCE'; participationId: number; participationVersion: number; attendance: 'ATTENDED' | 'NO_SHOW'; internalNote?: string }
  | { action: 'RECORD_INTRODUCTION_PERMISSION'; participationId: number; participationVersion: number; currentClub: string; evidence: string }
  | { action: 'REVOKE_INTRODUCTION_PERMISSION'; participationId: number; participationVersion: number; reason: string }
  | { action: 'OFFER'; groupId: number; groupVersion: number; responseDeadline?: string; completionDeadline?: string; reason?: string; internalNote?: string }
  | { action: 'ACCEPT_OFFER'; offerId: number; offerVersion: number; acceptTerms: true; emergencyContact?: string }
  | { action: 'DECLINE_OFFER' | 'WITHDRAW_OFFER'; offerId: number; offerVersion: number; reason: string }
  | { action: 'EXTEND_OFFER'; offerId: number; offerVersion: number; responseDeadline: string; reason: string }
  | { action: 'COMPLETE_REQUIREMENT'; requirementId: number; evidence: string }
  | { action: 'WAITLIST' | 'DECLINE' | 'WITHDRAW' | 'CANCEL_ENROLLMENT'; reason: string }
  | { action: 'CONFIRM_PRIMARY_CHANGE'; evidence: string; acceptTerms: true }
  | { action: 'ASSESS' | 'RECOMMEND'; groupId: number; internalNote: string; message?: string }
  | { action: 'APPROVE_ADMISSION'; groupId: number; reason: string }
);
export interface AdmissionWorkspace {
  organizationId: number; organizationName: string; clubId: number | null; canConfigure: boolean;
  groups: Opportunity[]; cases: AdmissionCase[]; squads: Choice[]; staff: Choice[];
  inquiries?: AdmissionInquiry[];
  sessions?: { id: number; squadId: number; title: string; startsAt: string; endsAt: string; location: string | null; revision: number }[];
}
export interface AdmissionHome { participants: Participant[]; cases: AdmissionCase[]; invitations?: AdmissionInvitation[]; selfCardNeedsDetails?: boolean; inquiries?: AdmissionInquiry[] }
export interface AdmissionError { code: string; message: string; currentVersion?: number }
export interface PlayerCardInput { requestId: string; fullName: string; dateOfBirth: string; gender?: 'MALE' | 'FEMALE' | null }
export interface AdmissionInvitation { id: number; version: number; organizationId: number; organizationName: string; groupId: number; groupName: string; intendedPlayerId: number | null; message: string; expiresAt: string; status: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED' }
export interface OfflineInvitationInput { requestId: string; groupId: number; recipientEmail: string; intendedPlayerId?: number | null; message: string }
export interface ClaimInvitationInput { requestId: string; expectedVersion: number; playerId: number; accept: boolean }
export interface GuardianReviewInput { requestId: string; reason: string }
export interface GroupSchedule { groupId: number; groupName: string; playerId: number; schedule: string; timezone: string; location: Location; terms: Terms; sessions: NonNullable<AdmissionWorkspace['sessions']> }

export type InquiryAction = 'MESSAGE' | 'WITHDRAW' | 'DECLINE' | 'ROUTE' | 'ASSOCIATE_PLAYER' | 'RESOLVE' | 'REOPEN' | 'REQUEST_SETUP';
export interface InquiryInput { requestId: string; playerId?: number | null; message: string; groupId?: number | null; programmeId?: number | null; squadId?: number | null }
export interface InquiryCommand extends CommandBase { action: InquiryAction; message: string; playerId?: number | null; groupId?: number; groupVersion?: number }
export interface AdmissionInquiry { id: number; version: number; playerId: number | null; playerName: string | null; conversationId?: number | null; groupId?: number | null; programmeId?: number | null; squadId?: number | null; applicantDestination?: string; staffDestination?: string; conversationDestination?: string | null; organizationId: number; organizationName: string; continuation?: InquiryContinuation; nextAction?: NextAction; setup?: InquirySetupCapability; status: 'OPEN' | 'ROUTED' | 'WITHDRAWN' | 'DECLINED' | 'RESOLVED'; message: string; caseId: number | null; actions: InquiryAction[]; history: CaseEvent[]; createdAt: string; updatedAt: string }

export type LifecycleDateAction = 'SET_REVIEW_DATE' | 'PROPOSE_DEPARTURE' | 'AGREE_DEPARTURE' | 'DECLINE_DEPARTURE' | 'PROPOSE_SEASON';
export interface LifecycleDateCommand { requestId:string; expectedVersion:number; action:LifecycleDateAction; date?:string; reason:string; groupId?:number; groupVersion?:number }
export interface Departure { status:'PROPOSED'|'AGREED'|'DECLINED'|'EFFECTIVE'; localDate:string; timezone:string; effectiveAt:string; proposedBy:number; proposedSide:'CLUB'|'APPLICANT'; agreedBy:number|null; reason:string }
export interface LifecycleDates { caseId:number; caseVersion:number; reviewDueAt:string|null; reviewTimezone:string; reviewSource:'EXPLICIT'|'DEFAULT'|'NONE'; reviewOverdue:boolean; reviewOwner:string; departure:Departure|null; seasonCaseId:number|null; seasonGroupName:string|null; seasonDestination:string|null; actions:LifecycleDateAction[] }
