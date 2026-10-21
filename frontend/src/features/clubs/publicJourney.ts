import { formatDate } from '../../utils/formatting';
import type { TrainingProgramme } from './presentation';

export interface PublicSquad { id: number; name: string; category: string; gender?: string; trainingDays?: number[]; trainingTime?: string | null }
export interface PublicResponsibility { title: string; specialisations: string[]; squadId: number | null; squadName: string | null; squadIds?:number[]; squadNames?:string[]; clubWide?:boolean; provenance?:string; startsOn: string; endsOn: string | null }
export interface PublicStaff { userId: number; fullName: string; avatarUrl?: string | null; role: string; title?: string | null; bio?: string | null; responsibilities: PublicResponsibility[] }
export interface ClubEnquiryContext { name: string; path: string; squadIds: number[]; intent?: "visit" | "question" }
export const trainingPath = (club: number, options: { programme?: number; squad?: number } = {}) => {
  const params = new URLSearchParams({ tab: 'teams' });
  if (options.programme) params.set('programme', String(options.programme));
  if (options.squad) params.set('squad', String(options.squad));
  return `/clubs/${club}?${params}`;
};
export const programmeMatchesAge = (p: TrainingProgramme, age: string) => age === '' || ((p.ageMin == null || Number(age) >= p.ageMin) && (p.ageMax == null || Number(age) <= p.ageMax));
export const staffMatchesSquad = (p: PublicStaff, squad: string) => !squad || p.responsibilities.some(r => r.clubWide===true || (r.squadIds??(r.squadId==null?[]:[r.squadId])).map(String).includes(squad) || r.clubWide==null&&r.squadId==null&&!r.squadIds?.length) || !p.responsibilities.length && ['OWNER','CLUB_ADMIN'].includes(p.role);
export const staffTitle = (p: Pick<PublicStaff, 'title' | 'role'>) => p.title?.trim() || ({ OWNER: 'Club leadership', CLUB_ADMIN: 'Club administration', COACH: 'Coach', CLUB_STAFF: 'Club staff' } as Record<string, string>)[p.role] || 'Club staff';
export function enquiryPriority(p: PublicStaff, squads: number[]) {
  const relevant = p.responsibilities.some(r => (r.clubWide===true || (r.squadIds??(r.squadId==null?[]:[r.squadId])).some(id=>squads.includes(id)) || r.clubWide==null&&r.squadId==null&&!r.squadIds?.length) && r.specialisations.some(s => ['HEAD_COACH','ASSISTANT_COACH','GOALKEEPER_COACH','TEAM_MANAGER','CLUB_SECRETARY'].includes(s)));
  return relevant ? 0 : ['OWNER','CLUB_ADMIN','COACH'].includes(p.role) ? 1 : 2;
}
/** "U14 · Boys": the squad's age group and who plays in it, in football words. */
export function squadLine(squad: PublicSquad) {
    const senior = squad.category === 'SENIOR';
    const who = squad.gender === 'MALE' ? (senior ? 'Men' : 'Boys') : squad.gender === 'FEMALE' ? (senior ? 'Women' : 'Girls') : squad.gender === 'MIXED' ? 'Mixed' : null;
    return [senior ? 'Senior' : squad.category, who].filter(Boolean).join(' · ');
}
/** "Tue & Thu 18:00" from a squad's weekly days (1 Monday … 7 Sunday; 0 is Sunday too) and start time; null until both are set. */
export function trainingDaysLine(days: number[] = [], time?: string | null) {
    if (!days.length || !time) return null;
    // 1 January 2024 was a Monday, so day n of that month is weekday n.
    const names = [...new Set(days.map(day => (day === 0 ? 7 : day)))].sort((a, b) => a - b).map(day => formatDate(new Date(2024, 0, day), { weekday: 'short' }));
    return `${names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0]} ${time}`;
}
