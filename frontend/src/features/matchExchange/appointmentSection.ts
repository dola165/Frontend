import type { Appointment } from "./api";

export function appointmentSection(a: Appointment, now: number) {
  if (a.status === "ACCEPTED" && a.inbox_section === "CURRENT") return "upcoming";
  const future = a.event_status === "SCHEDULED" && new Date(a.starts_at_iso).getTime() > now;
  return future && a.status === "INVITED" ? "invitations" : future && a.status === "ACCEPTED" ? "upcoming" : "history";
}
