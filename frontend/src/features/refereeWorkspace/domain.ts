import type { Appointment } from '../matchExchange/api';

export function refereeStage(a: Appointment, now: number) {
  if (a.event_status === 'CANCELLED' || !['INVITED', 'ACCEPTED'].includes(a.status)) return 'history';
  if (a.status === 'INVITED') return a.event_status === 'SCHEDULED' && Date.parse(a.starts_at_iso) > now ? 'invitations' : 'history';
  if (Date.parse(a.ends_at_iso) <= now) return !a.report_submitted_at ? 'follow-ups' : 'history';
  return a.event_status === 'SCHEDULED' ? 'upcoming' : 'history';
}
export function workspaceSection(hash: string) {
  const key = hash.slice(1);
  if (['invitations', 'upcoming', 'follow-ups', 'history'].includes(key) || key.startsWith('appointment-')) return 'assignments';
  if (['open-requests', 'offers'].includes(key) || key.startsWith('offer-')) return 'opportunities';
  return key === 'availability' || key === 'profile' ? key : 'overview';
}
export const covers = (windows: { starts_at: string; ends_at: string }[], start: string, end: string) => windows.some(w => Date.parse(w.starts_at) <= Date.parse(start) && Date.parse(w.ends_at) >= Date.parse(end));
