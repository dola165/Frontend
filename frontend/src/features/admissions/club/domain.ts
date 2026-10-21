import type { CaseStage, RequirementKind, Availability, AdmissionMethod } from '../types';
import type { ClubAdmissionCopyKey } from './copy';

export const stageCopy: Record<CaseStage, ClubAdmissionCopyKey> = { REQUEST_RECEIVED:'received', ARRANGING_PARTICIPATION:'arranging', INTRODUCTION_ASSESSMENT:'introduction', WAITLIST:'waitlist', PLACE_OFFERED:'offered', COMPLETING_ENROLLMENT:'completing', ENROLLED:'enrolled', CLOSED:'closed' };
export const methodCopy: Record<AdmissionMethod, ClubAdmissionCopyKey> = { DIRECT:'direct', INTRODUCTION:'introMethod', SELECTIVE:'selective' };
export const availabilityCopy: Record<Availability, ClubAdmissionCopyKey> = { PLACES_AVAILABLE:'placesAvailable', APPLICATIONS_OPEN:'applicationsOpen', INTRODUCTION_AVAILABLE:'introductionsAvailable', UPCOMING_ASSESSMENT:'upcomingAssessment', WAITLIST:'waitlist', CLOSED:'intakeClosed' };
export const requirementCopy: Record<RequirementKind, ClubAdmissionCopyKey> = { EMERGENCY_CONTACT:'emergencyRequirement', SCHOOL_ELIGIBILITY:'schoolRequirement', CURRENT_CLUB_PERMISSION:'clubPermission', PAYMENT_CONFIRMATION:'paymentRequirement', EXTERNAL_REGISTRATION:'externalRegistration', PRIMARY_AFFILIATION_CONFIRMATION:'primaryConfirmation', GUARDIAN_REVIEW:'guardianReview' };
export const ownerCopy = { CLUB:'club', APPLICANT:'applicant', REGISTRATION_STAFF:'registration', PLATFORM:'platformReviewer', NONE:'none' } as const;
export const participationCopy = { INVITED:'invited', CONFIRMED:'confirmed', RECONFIRM_REQUIRED:'reconfirm', DECLINED:'declined', ATTENDED:'attended', NO_SHOW:'noShow', CANCELLED:'cancelled' } as const;
export const offerCopy = { PENDING:'offerPending', ACCEPTED:'offerAccepted', DECLINED:'declined', WITHDRAWN:'offerWithdrawn', SUPERSEDED:'offerSuperseded', EXPIRED:'offerExpired' } as const;
export const nextCopy: Record<string,ClubAdmissionCopyKey> = { INTRODUCTION_PERMISSION_REQUIRED:'nextPermission',ELIGIBILITY_REVIEW:'nextEligibility',RESOLVE_EXPIRED_RESERVATION:'nextExpired',CONSENT_RECONFIRM_REQUIRED:'nextConsent',REVIEW_OVERDUE:'nextOverdue',CLUB_REVIEW:'nextReview',ARRANGE_SESSION:'nextArrange',REVIEW_PARTICIPATION:'nextAssess',WAIT_FOR_PLACE:'nextWait',RESPOND_OFFER:'nextOffer',COMPLETE_REQUIREMENTS:'nextRequirements',ENROLLED:'nextEnrolled',CLOSED:'nextClosed' };
export function localInput(iso: string) {
  const date = new Date(iso); if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function zonedInput(iso: string, timezone: string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));
  const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function utcInput(value: string, timezone?: string) {
  if(!timezone)return new Date(value).toISOString();
  if(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value))return new Date(value).toISOString();
  const wall=Date.parse(`${value.slice(0,16)}Z`), seconds=Date.parse(`${value}Z`)-wall;let instant=wall;
  for(let i=0;i<4;i++) { const displayed=Date.parse(`${zonedInput(new Date(instant).toISOString(),timezone)}Z`);const delta=wall-displayed;if(delta===0)break;instant+=delta; }
  if(zonedInput(new Date(instant).toISOString(),timezone)!==value.slice(0,16))throw new Error('This local time is not available in the chosen time zone.');
  return new Date(instant+seconds).toISOString();
}
