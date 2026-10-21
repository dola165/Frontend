import { ct } from '../store/copy';
import { Activity, TrendingUp, Briefcase, Camera, ClipboardList, Flag, Hand, HeartHandshake, HeartPulse, Megaphone, Search, Shirt, Stethoscope, Trophy, UserRound, Users, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import type { ClubJob, ClubJobCategory, ClubJobEngagementType } from '../clubs/api';

// ── Jobs & volunteering, for everyone ──
// One list: clubs' roles and people's listings (a parent hiring a coach for a child, a coach or referee saying they are
// available). HIRING means someone is wanted; OFFERING means someone is available. The fields beyond ClubJob are the
// backend's to add (BACKEND_NEEDS.md, "Jobs"); a job without them is a club's role, hiring, applied to in the app.

export type JobDirection = 'HIRING' | 'OFFERING';
export type JobHours = 'FULL_TIME' | 'PART_TIME' | 'SESSIONS' | 'MATCHDAYS' | 'VOLUNTEER';
export type JobApplyMethod = 'IN_APP' | 'MESSAGE' | 'EMAIL' | 'LINK';
export interface JobPoster { kind: 'CLUB' | 'PERSON'; id: number; name: string; avatarUrl: string | null; city: string | null }
export interface Job extends ClubJob {
    direction?: JobDirection | null;
    poster?: JobPoster | null;
    pay?: string | null;
    hours?: JobHours | null;
    licence?: string | null;
    applyMethod?: JobApplyMethod | null;
    applyTarget?: string | null;
    /** How far the place is from the area the list was asked for; only lists carry it. */
    distanceKm?: number | null;
    /** The viewer's application, on the front page's "Your applications". */
    application?: { id: number; status: string } | null;
    /** Where it is: a club's ground, or the person's town centre (`approximate`). */
    place?: { lat: number; lng: number; approximate?: 'area' | null } | null;
}
export type JobSort = 'RELEVANCE' | 'NEWEST' | 'NEAREST';

export const CATEGORIES: Array<{ value: ClubJobCategory; label: string; line: string; icon: LucideIcon }> = [
    { value: 'COACHING', label: 'Coaching', line: 'Head and assistant coaches, private sessions', icon: Trophy },
    { value: 'MATCHDAY', label: 'Matchday & referees', line: 'Referees, stewards, first aid', icon: Users },
    { value: 'MEDICAL', label: 'Medical', line: 'Physios, doctors, psychologists', icon: Stethoscope },
    { value: 'FOOTBALL_OPERATIONS', label: 'Analysis & operations', line: 'Analysts, scouts, team managers', icon: ClipboardList },
    { value: 'MEDIA_COMMUNICATIONS', label: 'Media', line: 'Photo, video, social', icon: Megaphone },
    { value: 'FACILITIES', label: 'Facilities', line: 'Grounds, kit, maintenance', icon: Wrench },
    { value: 'ADMINISTRATION', label: 'Administration', line: 'Office, finance, membership', icon: Briefcase },
    { value: 'OTHER', label: 'Volunteering & other', line: 'Everything else', icon: HeartHandshake },
];
/** The lines of work the front offers as circles: finer than the categories, each a category with a search word. */
export const LINES: Array<{ id: string; label: string; icon: LucideIcon; category: ClubJobCategory; query?: string }> = [
    { id: 'head-coach', label: 'Head coach', icon: Trophy, category: 'COACHING', query: 'head coach' },
    { id: 'assistant-coach', label: 'Assistant coach', icon: Users, category: 'COACHING', query: 'assistant' },
    { id: 'youth-coach', label: 'Youth coach', icon: UserRound, category: 'COACHING', query: 'youth' },
    { id: 'goalkeeper-coach', label: 'Goalkeeper coach', icon: Hand, category: 'COACHING', query: 'goalkeeper' },
    { id: 'private-trainer', label: 'Private trainer', icon: Activity, category: 'COACHING', query: 'trainer' },
    { id: 'referee', label: 'Referee', icon: Flag, category: 'MATCHDAY', query: 'referee' },
    { id: 'matchday', label: 'Matchday staff', icon: Users, category: 'MATCHDAY' },
    { id: 'physio', label: 'Physio', icon: HeartPulse, category: 'MEDICAL', query: 'physio' },
    { id: 'doctor', label: 'Doctor', icon: Stethoscope, category: 'MEDICAL', query: 'doctor' },
    { id: 'psychologist', label: 'Psychologist', icon: HeartHandshake, category: 'MEDICAL', query: 'psycholog' },
    { id: 'analyst', label: 'Analyst', icon: TrendingUp, category: 'FOOTBALL_OPERATIONS', query: 'analyst' },
    { id: 'scout', label: 'Scout', icon: Search, category: 'FOOTBALL_OPERATIONS', query: 'recruitment' },
    { id: 'team-manager', label: 'Team manager', icon: ClipboardList, category: 'FOOTBALL_OPERATIONS', query: 'manager' },
    { id: 'photographer', label: 'Photo & video', icon: Camera, category: 'MEDIA_COMMUNICATIONS', query: 'photo' },
    { id: 'social', label: 'Social media', icon: Megaphone, category: 'MEDIA_COMMUNICATIONS', query: 'social' },
    { id: 'grounds', label: 'Grounds', icon: Wrench, category: 'FACILITIES', query: 'ground' },
    { id: 'kit', label: 'Kit', icon: Shirt, category: 'FACILITIES', query: 'kit' },
    { id: 'admin', label: 'Administration', icon: Briefcase, category: 'ADMINISTRATION' },
    { id: 'finance', label: 'Finance', icon: Wallet, category: 'ADMINISTRATION', query: 'finance' },
    { id: 'volunteer', label: 'Volunteering', icon: HeartHandshake, category: 'OTHER' },
];
export const categoryLabel = (value?: string | null) => ct(CATEGORIES.find(c => c.value === value)?.label) ?? ct("Other");
export const TERMS: Array<{ value: ClubJobEngagementType; label: string }> = [{ value: 'PAID', label: 'Paid' }, { value: 'VOLUNTEER', label: 'Volunteer' }, { value: 'FLEXIBLE', label: 'Paid or volunteer' }];
export const termsLabel = (value?: string | null) => ct(TERMS.find(t => t.value === value)?.label) ?? null;
export const HOURS: Array<{ value: JobHours; label: string }> = [{ value: 'FULL_TIME', label: 'Full time' }, { value: 'PART_TIME', label: 'Part time' }, { value: 'SESSIONS', label: 'Sessions' }, { value: 'MATCHDAYS', label: 'Match days' }, { value: 'VOLUNTEER', label: 'Volunteer hours' }];
export const hoursLabel = (value?: string | null) => ct(HOURS.find(h => h.value === value)?.label) ?? null;
export const DIRECTIONS: Array<{ value: JobDirection; label: string; line: string }> = [{ value: 'HIRING', label: 'Jobs', line: 'Someone is wanted' }, { value: 'OFFERING', label: 'People available', line: 'Someone is available' }];

export const directionOf = (job: Job): JobDirection => job.direction ?? 'HIRING';
export const posterOf = (job: Job): JobPoster => job.poster ?? { kind: 'CLUB', id: job.clubId ?? 0, name: job.clubName ?? ct("Club"), avatarUrl: job.clubLogoUrl ?? null, city: job.clubCityName ?? null };
export const applyMethodOf = (job: Job): JobApplyMethod => job.applyMethod ?? (job.requiredRole === 'COACH' || job.requiredRole === 'PLAYER' ? 'IN_APP' : posterOf(job).kind === 'PERSON' ? 'MESSAGE' : 'EMAIL');
export const placeOf = (job: Job) => job.clubCityName ?? posterOf(job).city ?? null;
/** "3 days ago", "today", "2 weeks ago". */
export const postedLabel = (value?: string | null) => {
    const time = value ? Date.parse(value) : NaN;
    if (!Number.isFinite(time)) return null;
    const days = Math.floor((Date.now() - time) / 86_400_000);
    return days <= 0 ? ct("Today") : days === 1 ? ct("Yesterday") : days < 7 ? ct("{v0} days ago", { v0: days }) : days < 30 ? ct("{v0} {v1} ago", { v0: Math.floor(days / 7), v1: ct(Math.floor(days / 7) === 1 ? 'week' : 'weeks') }) : ct("{v0} {v1} ago", { v0: Math.floor(days / 30), v1: ct(Math.floor(days / 30) === 1 ? 'month' : 'months') });
};
export const distanceLabel = (km: number) => km < 1 ? ct("under 1 km") : ct("{v0} km", { v0: Math.round(km) });

export interface JobsQuery { page?: number; size?: number; query?: string; direction?: JobDirection | 'ALL'; category?: string; terms?: string; hours?: string; poster?: 'clubs' | 'people'; country?: string; city?: string; posted?: string; clubId?: number; sort?: JobSort; near?: string }
export interface JobPage { content: Job[]; totalElements: number }
export const fetchJobs = async (params: JobsQuery, signal?: AbortSignal) => (await apiClient.get<JobPage>('/jobs', { params: { page: 0, ...params }, signal })).data;
export const fetchJob = async (id: number, near?: string, signal?: AbortSignal) => (await apiClient.get<Job>(`/jobs/${id}`, { params: { near }, signal })).data;
/** The jobs front in one request. Backend needed: GET /jobs/front?near=City. */
/** A pin on the jobs map: a club's open roles at its ground, or people's listings counted at a town. */
export interface JobPin { kind: 'club' | 'area'; clubId: number | null; label: string; crest: string | null; lat: number; lng: number; count: number }
export interface JobsFront { city: string | null; role: string | null; pins: JobPin[]; forYou: Job[]; near: Job[]; offering: Job[]; followed: Job[]; fresh: Job[]; applications: Job[]; postings: Job[]; open: number; available: number }
export const fetchJobsFront = async (near: string | undefined, signal?: AbortSignal) => (await apiClient.get<JobsFront>('/jobs/front', { params: { near }, signal })).data;
export interface JobInput { posterKind: 'CLUB' | 'PERSON'; clubId?: number | null; direction: JobDirection; title: string; description: string; category: ClubJobCategory; engagementType: ClubJobEngagementType; hours: JobHours | null; pay: string; city: string; licence?: string; applyMethod: JobApplyMethod; applyTarget?: string; /** Who the in-app application is for (coaching only today). */ requiredRole?: 'COACH' | null }
/** Backend needed: POST /jobs for people and clubs alike (the club's own endpoint stays for the workspace). */
export const postJob = async (input: JobInput) => (await apiClient.post<Job>('/jobs', input)).data;
