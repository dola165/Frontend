import type { TrainingProgramme } from './presentation';

export interface PublicSquad { id: number; name: string; category: string; gender?: string }
export interface PublicResponsibility { title: string; specialisations: string[]; squadId: number | null; squadName: string | null; startsOn: string; endsOn: string | null }
export interface PublicStaff { userId: number; fullName: string; avatarUrl?: string | null; role: string; title?: string | null; bio?: string | null; responsibilities: PublicResponsibility[] }
export interface ClubEnquiryContext { name: string; path: string; squadIds: number[] }
export const trainingPath = (club: number, options: { programme?: number; squad?: number } = {}) => {
  const params = new URLSearchParams({ tab: 'teams' });
  if (options.programme) params.set('programme', String(options.programme));
  if (options.squad) params.set('squad', String(options.squad));
  return `/clubs/${club}?${params}`;
};
export const programmeMatchesAge = (p: TrainingProgramme, age: string) => age === '' || ((p.ageMin == null || Number(age) >= p.ageMin) && (p.ageMax == null || Number(age) <= p.ageMax));
export const staffMatchesSquad = (p: PublicStaff, squad: string) => !squad || p.responsibilities.some(r => r.squadId == null || String(r.squadId) === squad) || !p.responsibilities.length && ['OWNER','CLUB_ADMIN'].includes(p.role);
export const staffTitle = (p: Pick<PublicStaff, 'title' | 'role'>) => p.title?.trim() || ({ OWNER: 'Club leadership', CLUB_ADMIN: 'Club administration', COACH: 'Coach', CLUB_STAFF: 'Club staff' } as Record<string, string>)[p.role] || 'Club staff';
export function enquiryPriority(p: PublicStaff, squads: number[]) {
  const relevant = p.responsibilities.some(r => (r.squadId == null || squads.includes(r.squadId)) && r.specialisations.some(s => ['HEAD_COACH','ASSISTANT_COACH','GOALKEEPER_COACH','TEAM_MANAGER','CLUB_SECRETARY'].includes(s)));
  return relevant ? 0 : ['OWNER','CLUB_ADMIN','COACH'].includes(p.role) ? 1 : 2;
}
