import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentCard } from "../AppointmentCard";
import { appointmentSection } from "../appointmentSection";
import { FixtureCancellation, VenueFollowUp } from "../FixtureRecovery";
import { MatchDetailPage } from "../../../pages/MatchDetailPage";
import { RefereePage } from "../../../pages/RefereePage";
import { post, type Appointment, type ChangeImpact, type Match } from "../api";
import { useLoad } from "../hooks";
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({sessionId: "referee-test"}) }));
vi.mock("../useRefereeHistory", () => ({useRefereeHistory: (path: string) => useLoad(path)}));

vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), post: vi.fn(), put: vi.fn() }));
vi.mock("../hooks", async original => ({ ...await original<typeof import("../hooks")>(), useLoad: vi.fn(), useClock: () => Date.parse("2099-09-20T08:00:00Z") }));
vi.mock("../MatchResultSection", () => ({ MatchResultSection: () => null }));
vi.mock("../../../api/chat", () => ({ chatApi: { findConversationByContext: vi.fn().mockResolvedValue(null) } }));

const appointment: Appointment = {
  id: 91, event_id: 12, referee_id: 8, title: "Synthetic friendly", duty: "REFEREE", status: "INVITED",
  volunteer: false, fee: 50, currency: "GEL", report: null, report_submitted_at: null,
  starts_at: "2099-09-20T14:00:00", ends_at: "2099-09-20T15:00:00", starts_at_iso: "2099-09-20T10:00:00Z", ends_at_iso: "2099-09-20T11:00:00Z",
  timezone: "Asia/Tbilisi", event_status: "SCHEDULED", club_name: "Home", opponent_name: "Away", location_name: "Synthetic ground",
  invited_by_name: "Synthetic host", venue_status: "HOST_CONFIRMED", allowed_actions: ["ACCEPT", "DECLINE"], acceptance_blocker: null,
};
const match: Match = {
  event_id: 12, title: "Synthetic friendly", revision: 7, squad_id: 1, club_id: 1, club_name: "Home", squad_name: "U14",
  home_score: null, away_score: null, club_profile_kind: "ACADEMY", club_logo_url: null, club_banner_url: null,
  description: "Synthetic scheduled friendly with an agreed opponent and external ground.",
  age_group: "U14", level: "DEVELOPMENT", format: "7_A_SIDE", location_name: "Synthetic ground", city: "Tbilisi",
  location_lat: null, location_lng: null, venue_preference: "HOME", referee_required: true, venue_id: null,
  starts_at: appointment.starts_at, ends_at: appointment.ends_at, starts_at_iso: appointment.starts_at_iso, ends_at_iso: appointment.ends_at_iso, timezone: "Asia/Tbilisi",
  listing_status: "ARRANGED", event_status: "SCHEDULED", venue_status: "HOST_CONFIRMED", referee_status: "INVITED",
  opponent_name: "Away", opponent_club_id: 2, opponent_squad_name: "U14", target_squad_id: 2, head_coach_id: 5, coach_name: "Synthetic host",
  can_manage: false, can_arrange: false, can_record_result: false, proposals: [], own_appointments: [appointment], appointments: [appointment],
  external_venue_confirmed: true, booking_id: null,
};
const impact: ChangeImpact = {
  action: "CANCEL", revision: 7, material: true, changedFields: ["status"], confirmationRequired: true, confirmationToken: "current-token",
  dependencies: [{ domain: "EXTERNAL_VENUE", id: null, state: "HOST_CONFIRMED", consequence: "PRESERVE_UNTIL_HOST_RESOLVES" }],
  needsAttention: [{ code: "RESOLVE_EXTERNAL_VENUE", id: null, message: "Follow up with the ground owner. Original evidence remains.", blocking: false }],
};
const reload = vi.fn();
function card(a = appointment) { return render(<MemoryRouter initialEntries={["/match-exchange/12#appointment-91"]}><AppointmentCard appointment={a} reload={reload} /></MemoryRouter>); }

beforeEach(() => {
  vi.clearAllMocks();vi.mocked(post).mockResolvedValue({});
  vi.mocked(useLoad).mockImplementation(path => ({ data: path === "/match-exchange/12" ? match : [], error: "", reload }));
});
afterEach(cleanup);

describe("referee appointment journey", () => {
  it("opens the exact owned card from match notification and exposes the same actions in workspace", async () => {
    const detail=render(<MemoryRouter initialEntries={["/match-exchange/12#appointment-91"]}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
    expect(document.getElementById("appointment-91")).toHaveFocus();
    detail.unmount();
    vi.mocked(useLoad).mockImplementation(path => ({ data: path === '/club-operations/mine' ? {appointments:[]} : path.includes('/appointments/') ? appointment : path === '/match-arrangements/official-requests' ? [] : { profile: { user_id: 8, published: true }, appointments: [appointment], availability: [] }, error: "", reload }));
    render(<MemoryRouter initialEntries={["/referees/me#appointment-91"]}><Routes><Route path="/referees/:refereeId" element={<RefereePage />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/referees/me/appointments/91/decision", { action: "ACCEPT" }));
    expect(screen.getByRole("link", { name: /Invitations\s*1/ })).toHaveAttribute("href", "/referees/me#invitations");
  });

  it("explains missing availability before submit and offers the exact setup route", () => {
    card({ ...appointment, allowed_actions: ["DECLINE"], acceptance_blocker: "AVAILABILITY_REQUIRED" });
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline invitation" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Set availability for the whole match" })).toHaveAttribute("href", "/referees/me#availability");
    expect(screen.getByText(/14:00.*Asia\/Tbilisi/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("withdraws the appointment after explaining host replacement without cancelling the fixture", async () => {
    card({ ...appointment, status: "ACCEPTED", allowed_actions: ["WITHDRAW"] });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw from appointment" }));
    expect(screen.getByText(/fixture stays scheduled/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm withdrawal" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/referees/me/appointments/91/decision", { action: "WITHDRAW" }));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("refreshes stale decisions and permits an explicit retry against updated prerequisites", async () => {
    vi.mocked(post).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } }).mockResolvedValueOnce({});
    const view=card();fireEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    await screen.findByRole("alert");expect(reload).toHaveBeenCalledOnce();
    view.rerender(<MemoryRouter><AppointmentCard appointment={{ ...appointment, allowed_actions: ["DECLINE"], acceptance_blocker: "PERSONAL_EVENT_CONFLICT" }} reload={reload} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Review My schedule" })).toHaveAttribute("href", "/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Decline invitation" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  });

  it("retains the late inability draft on failure and uses a stable retry identity", async () => {
    const late={ ...appointment, status: "ACCEPTED", starts_at_iso: "2099-09-20T07:30:00Z", allowed_actions: ["REPORT_INABILITY"], acceptance_blocker: "KICKOFF_PASSED" };
    vi.mocked(post).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});card(late);
    expect(screen.queryByRole("button", { name: "Withdraw from appointment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Report inability to attend", { selector: "summary" }));
    fireEvent.change(screen.getByLabelText("Reason for the coaching teams"), { target: { value: "Cannot reach the ground" } });
    fireEvent.click(screen.getByRole("button", { name: "Report inability to attend" }));
    await screen.findByRole("alert");expect(screen.getByLabelText("Reason for the coaching teams")).toHaveValue("Cannot reach the ground");
    fireEvent.click(screen.getByRole("button", { name: "Report inability to attend" }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(vi.mocked(post).mock.calls[0]).toEqual(vi.mocked(post).mock.calls[1]);
    expect(vi.mocked(post).mock.calls[0][0]).toBe("/referees/me/appointments/91/attendance-issue");
  });

  it("puts expired invitations and finished/cancelled appointments into history", () => {
    const now=Date.parse("2099-09-20T08:00:00Z");
    expect(appointmentSection(appointment,now)).toBe("invitations");
    expect(appointmentSection({ ...appointment, status:"ACCEPTED" },now)).toBe("upcoming");
    expect(appointmentSection({ ...appointment, starts_at_iso:"2099-09-19T08:00:00Z" },now)).toBe("history");
    expect(appointmentSection({ ...appointment, event_status:"CANCELLED" },now)).toBe("history");
  });

  it("keeps a completed accepted appointment current until its report is recorded", () => {
    const completed = { ...appointment, status: "ACCEPTED", event_status: "COMPLETED", starts_at_iso: "2099-09-19T08:00:00Z", inbox_section: "CURRENT" as const };
    expect(appointmentSection(completed, Date.parse("2099-09-20T08:00:00Z"))).toBe("upcoming");
    expect(appointmentSection({ ...completed, inbox_section: "HISTORY" }, Date.parse("2099-09-20T08:00:00Z"))).toBe("history");
  });

  it("does not show owner or staff actions to a family viewer and does not call agreement fully ready", () => {
    vi.mocked(useLoad).mockImplementation(path=>({ data: path==="/match-exchange/12" ? { ...match, own_appointments:[], referee_status:"NEEDED", venue_status:"NEEDED" } : [], error:"", reload }));
    render(<MemoryRouter initialEntries={["/match-exchange/12"]}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage />} /></Routes></MemoryRouter>);
    expect(screen.queryByRole("button", { name:"Accept invitation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name:"Cancel fixture" })).not.toBeInTheDocument();
    expect(screen.queryByText("Communication")).not.toBeInTheDocument();
    expect(screen.getByText("Host: confirm the pitch or follow up on its reservation.")).toBeInTheDocument();
  });
});

describe("cancellation and venue recovery", () => {
  it("requires a started-fixture reason, previews nonblocking venue follow-up and confirms the same token", async () => {
    vi.mocked(post).mockResolvedValueOnce(impact).mockResolvedValueOnce({});
    render(<MemoryRouter><FixtureCancellation match={match} reload={reload} started /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Cancel fixture"}));
    expect(screen.getByRole("button",{name:"Review cancellation"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Why could this fixture not be played or completed?"),{target:{value:"No show"}});
    fireEvent.click(screen.getByRole("button",{name:"Review cancellation"}));
    await screen.findByRole("button",{name:"Confirm cancellation and notify participants"});
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Confirm cancellation and notify participants"}));
    await waitFor(()=>expect(reload).toHaveBeenCalledOnce());
    expect(vi.mocked(post).mock.calls[0][0]).toBe("/match-exchange/12/close-preview");
    expect(vi.mocked(post).mock.calls[1]).toEqual(["/match-exchange/12/close",vi.mocked(post).mock.calls[0][1],"current-token"]);
  });

  it("requires a new review when the reason or revision changes and preserves the reason after conflict", async () => {
    vi.mocked(post).mockResolvedValueOnce(impact).mockRejectedValueOnce({isAxiosError:true,response:{status:409}});
    render(<MemoryRouter><FixtureCancellation match={match} reload={reload} started /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Cancel fixture"}));
    fireEvent.change(screen.getByLabelText("Why could this fixture not be played or completed?"),{target:{value:"No show"}});
    fireEvent.click(screen.getByRole("button",{name:"Review cancellation"}));
    await screen.findByRole("button",{name:"Confirm cancellation and notify participants"});
    fireEvent.change(screen.getByLabelText("Why could this fixture not be played or completed?"),{target:{value:"Abandoned"}});
    fireEvent.click(screen.getByRole("button",{name:"Review cancellation"}));
    await screen.findByRole("alert");expect(screen.getByLabelText("Why could this fixture not be played or completed?")).toHaveValue("Abandoned");
    expect(vi.mocked(post).mock.calls[1][0]).toBe("/match-exchange/12/close-preview");
    expect(vi.mocked(post).mock.calls[1][2]).toBeUndefined();
  });

  it("offers external reconciliation only to the host and never sends a financial booking mutation", async () => {
    const view=render(<MemoryRouter><VenueFollowUp match={{...match,can_manage:true}} reload={reload}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Outcome agreed with the ground owner"),{target:{value:"Owner contacted"}});
    fireEvent.click(screen.getByRole("button",{name:"Record external venue follow-up"}));
    await waitFor(()=>expect(post).toHaveBeenCalledWith("/match-exchange/12/external-venue-resolution",expect.objectContaining({reason:"Owner contacted",revision:7})));
    view.rerender(<MemoryRouter><VenueFollowUp match={{...match,booking_id:17,external_venue_confirmed:false}} reload={reload}/></MemoryRouter>);
    expect(screen.queryByRole("button",{name:"Record external venue follow-up"})).not.toBeInTheDocument();
    expect(screen.getByText(/does not cancel or refund/)).toBeInTheDocument();
  });
});
