export type TournamentRefereeAppointment = {
  id: number; fixture_id: number; tournament_id: number; referee_id: number;
  tournament_name: string; fixture_order: number; home_name: string; away_name: string;
  full_name: string; duty: string; status: string; fixture_status: string; tournament_status: string;
  location_name?: string | null;
  booking_status?: string | null;
  starts_at: string; ends_at: string; timezone: string;
  volunteer: boolean; fee: number | null; currency: string | null;
  report: string | null; report_submitted_at: string | null;
};
export const fixtureRefereesPath = (tournament: number, fixture: number) =>
  `/tournaments/${tournament}/fixtures/${fixture}/referees`;
export const tournamentRefereeInboxPath = '/referees/me/tournament-appointments';
export const appointmentTime = (value: string, timezone: string) =>
  new Date(value).toLocaleString(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' });
