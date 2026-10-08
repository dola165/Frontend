import { apiClient } from '../../api/axiosConfig';

export interface Field { key: string; label: string; type: string; required: boolean; options: string[] }
export interface Definition { module: string; kind: string; label: string; states: string[]; fields: Field[] }
export interface Choice { id: number; name: string }
export interface OperationRecord {
  id: number; club_id: number; module: string; kind: string; title: string; status: string;
  squad_id: number | null; subject_user_id: number | null; assigned_user_id: number | null;
  event_id: number | null; session_id: number | null; related_record_id: number | null; due_on: string | null;
  data: Record<string, string>; revision: number; canEdit: boolean; transitions: string[];
  created_at: string; updated_at: string;
  attentionDate?:string|null;expired?:boolean;map_plan_id?:number|null;
}
export interface Appointment {
  id: number; club_id: number; club_name?: string; user_id: number; name?: string; title: string;
  specialisations: string[]; engagement: string; squad_id: number | null; squad_name?: string | null; permissions: string[];
  starts_on: string; ends_on: string | null; status: string; revision: number;
  published: boolean; timezone?: string; squad_ids?: number[]; squad_names?: string[]; club_wide?: boolean; effective_status?: string; unavailable_reason?: string | null; expires_at?: string; provenance?: string;
}
export interface Settings {
  setting: string; playing_level: string; currency?: string | null; country_code?: string | null;
  timezone?: string | null; legal_name?: string | null; registration_reference?: string | null;
  enabled_modules: string[]; revision: number;
}
export interface Bootstrap {
  defaultSquadId?: number;
  defaultSessionId?: number;
  defaultSubjectId?: number;
  peopleBySquad?: { id:number; squad_id:number }[];
  clubId: number; clubName: string; leadership: boolean; actorId: number; definitions: Definition[];
  canReadMatches?:boolean;
  specialisations: string[]; permissions: string[]; settings: Settings;
  modules: { id: string; writable: boolean; globalWrite: boolean; writeSquads: number[]; globalRead?: boolean; readSquads?: number[] }[];
  squads: Choice[]; people: Choice[]; staff: Choice[]; venues: Choice[]; guardians: (Choice & { child_id: number })[];
  events: { id: number; title: string; starts_at: string }[];
  sessions: { id:number;title:string;starts_at:string;squad_name:string; squad_id?:number }[];
  links: { id: number; title: string; module: string; kind: string; squad_id: number | null }[];
}
export interface History { id: number; action: string; from_status: string | null; to_status: string | null; note: string | null; actor: string; created_at: string }
export const root = (club: number) => `/clubs/${club}/operations`;
export const get = async <T>(path: string, signal?: AbortSignal) => (await apiClient.get<T>(path, { signal })).data;
export const put = async <T>(path: string, body: unknown) => (await apiClient.put<T>(path, body)).data;
export const post = async <T>(path: string, body: unknown) => (await apiClient.post<T>(path, body)).data;
export const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const appointmentStatus = (a:Appointment) => a.effective_status?label(a.effective_status):a.status==='ACTIVE'?(a.ends_on&&a.ends_on.slice(0,10)<clubToday(a.timezone)?'Expired':a.starts_on.slice(0,10)>clubToday(a.timezone)?'Upcoming':'Active'):label(a.status);
export const appointmentSquads = (a: Pick<Appointment,'squad_id'|'squad_ids'>) => a.squad_ids ?? (a.squad_id == null ? [] : [a.squad_id]);
export const scopePayload = (scope: {clubWide:boolean;squadIds:number[]}) => ({clubWide:scope.clubWide,squadIds:scope.clubWide?[]:[...scope.squadIds].sort((a,b)=>a-b)});
export const appointmentScope = (a: Pick<Appointment,'squad_id'|'squad_ids'|'squad_name'|'squad_names'>, choices: Choice[] = []) => {
  const ids=appointmentSquads(a);return !ids.length?(a.squad_ids?'Whole club':a.squad_name||'Whole club'):ids.map((id,i)=>a.squad_names?.[i] ?? choices.find(s=>s.id===id)?.name ?? (ids.length===1?a.squad_name:null) ?? `Team #${id}`).join(', ');
};
export const moduleNames: Record<string, string> = {
  STAFF: 'Staff & duties', CREDENTIALS: 'Credentials', FACILITIES: 'Venues & facilities', READINESS: 'Emergency & match preparation',
  GUARDIANS: 'Guardians & permissions', ATTENDANCE: 'Attendance & collection', WELFARE: 'Confidential welfare',
  MEDICAL: 'Medical coordination', AVAILABILITY: 'Participation restrictions', DEVELOPMENT: 'Player development',
  EDUCATION: 'Education', REGISTRATION: 'Registration & eligibility', EQUIPMENT: 'Equipment', FINANCE: 'Finance',
  TRAVEL: 'Travel', SPECIALISTS: 'External specialists', DEPARTURES: 'Departures', MATCHES: 'Match arrangements',
};
export const moduleGroups = [
  { name: 'People', ids: ['STAFF', 'CREDENTIALS', 'GUARDIANS', 'ATTENDANCE', 'DEVELOPMENT', 'EDUCATION', 'REGISTRATION', 'DEPARTURES'] },
  { name: 'Operations', ids: ['FACILITIES', 'READINESS', 'EQUIPMENT', 'FINANCE', 'TRAVEL', 'SPECIALISTS'] },
  { name: 'Care', ids: ['AVAILABILITY', 'MEDICAL', 'WELFARE'] },
];
export const transitionLabel = (kind: string, state: string) => {
  if(kind==='ATTENDANCE'&&state==='EXPECTED')return 'Correct attendance (reason required)';
  const names: Record<string, string> = { PUBLISHED: 'Publish facility', DRAFT: 'Unpublish', GRANTED: 'Give permission', DECLINED: 'Decline', REVOKED: 'Withdraw permission', ARRIVED: kind === 'ATTENDANCE' ? 'Record arrival' : 'Record destination arrival', COLLECTED: 'Record collection', ABSENT: 'Mark absent', CLUB_CHECKED: 'Record club evidence review', APPROVED: 'Approve', SUBMITTED: 'Submit for approval', PAID: 'Record manual settlement', RETURNED: kind === 'TRIP' || kind === 'PASSENGER' ? 'Record return' : 'Record equipment return', CLEARED: 'Record professional clearance', BOARDED: 'Record boarding', ENDED: 'End', ARCHIVED: 'Archive' };
  return names[state] ?? label(state);
};

export const dateOnly = (value?: string | null) => value?.slice(0, 10) ?? '';

/** Calendar dates follow the club, including when UTC is still on the previous day. */
export const clubToday = (timezone = 'Asia/Tbilisi', now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
