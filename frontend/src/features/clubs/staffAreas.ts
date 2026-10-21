import type { PublicStaff } from './publicJourney';

/** The areas of a club's staff a set of responsibility codes belongs to (coaching, analysis, performance, care, officials, operations). */
export const responsibilityAreas = (codes: string[]) => {
  const roles = codes.join(' '), result: string[] = [];
  if (/COACH|STRENGTH/.test(roles)) result.push('coaching');
  if (/ANALYST|ANALYSIS|SCOUT/.test(roles)) result.push('analysis');
  if (/SPORTS_SCIEN|STRENGTH|NUTRITION|PERFORMANCE_DIRECTOR/.test(roles)) result.push('performance');
  if (/PHYSIO|MEDICAL|THERAP|REHABILITATION|NUTRITION|WELFARE|PSYCHOLOGIST/.test(roles)) result.push('care');
  if (/REFEREE/.test(roles)) result.push('officials');
  if (/MANAGER|SECRETARY|FINANCE|EQUIPMENT|EDUCATION|TEAM_SUPPORT/.test(roles) || !result.length) result.push('operations');
  return result;
};
/** The areas one published staff member works in: from their responsibilities, else coaching for a coach and club operations for anyone else. */
export const staffAreas = (person: PublicStaff) => person.responsibilities.length
  ? [...new Set(person.responsibilities.flatMap(r => responsibilityAreas(r.specialisations)))]
  : person.role === 'COACH' ? ['coaching'] : ['operations'];
