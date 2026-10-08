import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isAxiosError } from "axios";
import { CalendarDays, MapPin, RefreshCw } from "lucide-react";
import { extractApiErrorMessage } from "../../utils/apiError";
import { post, put, type Appointment } from "./api";
import { useClock } from "./hooks";
import { Status } from "./shared";
import { journeyLabel, matchSchedule, useJourneyCopy, type JourneyKey } from "./journeyCopy";
import { useRefereeWorkspace } from '../refereeWorkspace/WorkspaceContext';

const blockerCopy: Record<string, JourneyKey> = {
  REFEREE_ROLE_REQUIRED: "roleRequired", PROFILE_REQUIRED: "profileRequired",
  AVAILABILITY_REQUIRED: "availabilityRequired", APPOINTMENT_CONFLICT: "appointmentConflict",
  PERSONAL_EVENT_CONFLICT: "personalConflict", KICKOFF_PASSED: "kickoffPassed", FIXTURE_CLOSED: "fixtureClosed",
};

export function AppointmentCard({ appointment: a, reload, embedded = false }: { appointment: Appointment; reload: () => void; embedded?: boolean }) {
  const workspace = useRefereeWorkspace();
  const now = useClock(), { copy, language } = useJourneyCopy(), { hash, pathname } = useLocation();
  const card = useRef<HTMLElement>(null), inFlight = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [withdraw, setWithdraw] = useState(false), [reason, setReason] = useState(""), [report, setReport] = useState(a.report || "");
  const [issueRequestId] = useState(() => crypto.randomUUID());
  const future = a.event_status === "SCHEDULED" && new Date(a.starts_at_iso).getTime() > now;
  const actions = a.allowed_actions || [];
  const can = (action: string) => a.event_status === "SCHEDULED" && actions.includes(action) && (action === "REPORT_INABILITY" ? !future : future);
  const anchor = `appointment-${a.id}`;
  const inWorkspacePanel = embedded && !!workspace;
  useEffect(() => {
    if (!inWorkspacePanel && hash === `#${anchor}`) { card.current?.scrollIntoView?.({ block: "center" }); card.current?.focus({ preventScroll: true }); }
  }, [hash, anchor, inWorkspacePanel]);
  async function submit(action: () => Promise<unknown>, success: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); setWithdraw(false); reload(); }
    catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) { setError(copy("conflict")); reload(); }
      else setError(extractApiErrorMessage(e, copy("failed")));
    } finally { inFlight.current = false; setBusy(false); }
  }
  const decision = (action: string, success: JourneyKey) => void submit(
    () => post(`/referees/me/appointments/${a.id}/decision`, { action }), copy(success));
  const blocker = a.acceptance_blocker;
  const schedule = matchSchedule(a.starts_at_iso, a.ends_at_iso, a.timezone, language);
  return <article className={`mx-panel mx-appointment is-${a.status.toLowerCase()}`} id={inWorkspacePanel ? undefined : anchor} tabIndex={-1} ref={card} aria-label={`${copy("yourAppointment")}: ${a.title}`}>
    <div className="mx-appointment-heading">
      <span className="mx-appointment-duty">{journeyLabel(a.duty, language)}</span>
      <div className="mx-appointment-state"><Status value={a.event_status === "CANCELLED" ? "CANCELLED" : a.status} />
        <button className="mx-refresh" disabled={busy} onClick={reload} aria-label={copy("refresh")} title={copy("refresh")}><RefreshCw size={16} aria-hidden="true" /></button>
      </div>
    </div>
    <h3>{embedded ? copy("yourAppointment") : workspace ? <button className="rw-title-button" onClick={() => workspace.openMatch(a.event_id)}>{a.title}</button> : <Link to={`/match-exchange/${a.event_id}#${anchor}`}>{a.title}</Link>}</h3>
    {!embedded && <p className="mx-appointment-teams">{a.club_name} · {a.opponent_name || copy("opponentPending")}</p>}
    <div className="mx-appointment-overview">
      <div className="mx-appointment-facts">
        <p><CalendarDays size={17} aria-hidden="true" /><span><strong>{schedule.date}</strong><span>{schedule.time} · {a.timezone}</span></span></p>
        <p><MapPin size={17} aria-hidden="true" /><span>{a.location_name}{a.venue_status && <small>{copy("venue")}: {journeyLabel(a.venue_status, language)}</small>}</span></p>
      </div>
      <div className="mx-appointment-terms"><small>{copy("appointmentTerms")}</small><strong>{a.volunteer ? copy("volunteer") : `${a.fee} ${a.currency}`}</strong>
        {!a.volunteer && <span>{copy("noPayment")}</span>}
        {a.invited_by_name && <span>{copy("invitedBy")}: {a.invited_by_name}</span>}
      </div>
    </div>
    {error && <p role="alert" className="mx-error">{error}</p>}
    {notice && <p role="status" className="mx-notice">{notice}</p>}
    {blocker && <p className="mx-notice">{blockerCopy[blocker] ? copy(blockerCopy[blocker]) : a.action_explanation}</p>}
    {!a.allowed_actions && <p className="mx-notice">{copy("prerequisitesUnknown")}</p>}
    <div className="mx-actions mx-appointment-decisions">
      {blocker === "AVAILABILITY_REQUIRED" && (workspace ? <button onClick={() => workspace.addAvailability(a)}>{copy("availability")}</button> : <Link className="mx-button" to="/referees/me#availability">{copy("availability")}</Link>)}
      {blocker === "PROFILE_REQUIRED" && <Link className="mx-button" to="/referees/me#profile">{copy("profile")}</Link>}
      {blocker === "REFEREE_ROLE_REQUIRED" && <Link className="mx-button" to="/account/roles">{copy("roles")}</Link>}
      {["APPOINTMENT_CONFLICT", "PERSONAL_EVENT_CONFLICT"].includes(blocker || "") && <Link className="mx-button" to="/calendar">{copy("schedule")}</Link>}
      {a.status === "INVITED" && future && <>
        <button className="mx-primary" disabled={busy || !can("ACCEPT")} onClick={() => decision("ACCEPT", "accepted")}>{copy("accept")}</button>
        <button disabled={busy || !can("DECLINE")} onClick={() => decision("DECLINE", "declined")}>{copy("decline")}</button>
      </>}
      {can("WITHDRAW") && <button disabled={busy} onClick={() => setWithdraw(v => !v)}>{copy("withdraw")}</button>}
    </div>
    {withdraw && can("WITHDRAW") && <div className="mx-notice">
      <p>{copy("withdrawalHelp")}</p><div className="mx-actions">
        <button disabled={busy} onClick={() => decision("WITHDRAW", "withdrawn")}>{copy("confirmWithdraw")}</button>
        <button disabled={busy} onClick={() => setWithdraw(false)}>{copy("back")}</button>
      </div>
    </div>}
    {a.attendance_issue && <div className="mx-notice"><strong>{copy("issueRecorded")}</strong><p>{a.attendance_issue}</p><p>{copy("issueSaved")}</p></div>}
    {can("REPORT_INABILITY") && <details className="mx-followup"><summary>{copy("reportInability")}</summary>
      <p>{copy("lateHelp")}</p>
      <form className="mx-stack" onSubmit={e => { e.preventDefault(); void submit(() => post(`/referees/me/appointments/${a.id}/attendance-issue`, { reason, requestId: issueRequestId }), copy("issueSaved")); }}>
        <label>{copy("reason")}<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <p className="mx-muted">{copy("reasonPrivacy")}</p><button disabled={busy || !reason.trim()}>{copy("reportInability")}</button>
      </form>
    </details>}
    {a.status === "ACCEPTED" && blocker !== "REFEREE_ROLE_REQUIRED" && a.event_status !== "CANCELLED" && new Date(a.ends_at_iso).getTime() < now && <details className="mx-followup">
      <summary>{copy("report")}</summary><form className="mx-stack" onSubmit={e => { e.preventDefault(); void submit(() => put(`/referees/me/appointments/${a.id}/report`, { body: report }), copy("reportSaved")); }}>
        <label>{copy("report")}<textarea required maxLength={4000} value={report} onChange={e => setReport(e.target.value)} /></label>
        <p className="mx-muted">{copy("reasonPrivacy")}</p><button disabled={busy || !report.trim()}>{copy("saveReport")}</button>
      </form>
    </details>}
    {workspace && !embedded && <button className="rw-inline-link" onClick={() => workspace.openMatch(a.event_id)}>Match details, coordination & result →</button>}
    {!pathname.startsWith("/referees/") && <p className="mx-appointment-workspace"><Link to={`/referees/me#${anchor}`}>{copy("workspace")}</Link></p>}
  </article>;
}
