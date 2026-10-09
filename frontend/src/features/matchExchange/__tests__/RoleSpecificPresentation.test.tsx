import "../../../i18n";
vi.mock("../../../context/AuthContext",()=>({useAuth:()=>({user:{id:5,navigationCapabilities:{version:1,workspaces:[]}},sessionId:"presentation-test",isAuthenticated:true})}));
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppointmentCard } from "../AppointmentCard";
import { MatchDetailPage } from "../../../pages/MatchDetailPage";
import { MatchExchangePage } from "../../../pages/MatchExchangePage";
import { useAction, useClock, useLoad } from "../hooks";
import type { Appointment, Match } from "../api";

vi.mock("../hooks", () => ({ useLoad: vi.fn(), useAction: vi.fn(), useClock: vi.fn() }));
vi.mock("../MatchResultSection", () => ({ MatchResultSection: () => null }));
vi.mock("../../../api/chat", () => ({ chatApi: { findConversationByContext: vi.fn().mockResolvedValue(null) } }));

const appointment: Appointment = {
  id: 91, event_id: 12, referee_id: 8, title: "U14 development friendly", duty: "REFEREE", status: "INVITED",
  volunteer: false, fee: 50, currency: "GEL", report: null, report_submitted_at: null,
  starts_at: "2099-09-20T14:00:00", ends_at: "2099-09-20T15:30:00", starts_at_iso: "2099-09-20T10:00:00Z", ends_at_iso: "2099-09-20T11:30:00Z",
  timezone: "Asia/Tbilisi", event_status: "SCHEDULED", club_name: "Home Academy", opponent_name: "Away Academy", location_name: "Community ground",
  invited_by_name: "Host coach", venue_status: "HOST_CONFIRMED", allowed_actions: ["ACCEPT", "DECLINE"], acceptance_blocker: null,
};

const match: Match = {
  event_id: 12, squad_id: 1, squad_name: "U14", club_id: 1, club_name: "Home Academy", club_profile_kind: "ACADEMY", club_logo_url: null, club_banner_url: null,
  title: "U14 development friendly", description: "Balanced development match", starts_at: appointment.starts_at, ends_at: appointment.ends_at,
  starts_at_iso: appointment.starts_at_iso, ends_at_iso: appointment.ends_at_iso, timezone: appointment.timezone, city: "Tbilisi", location_name: appointment.location_name,
  location_lat: null, location_lng: null, age_group: "U14", level: "DEVELOPMENT", format: "7_A_SIDE", venue_preference: "HOME", referee_required: true,
  venue_id: null, booking_id: null, external_venue_confirmed: true, revision: 1, listing_status: "ARRANGED", event_status: "SCHEDULED",
  venue_status: "HOST_CONFIRMED", referee_status: "INVITED", opponent_name: "Away Academy", opponent_club_id: 2, opponent_squad_name: "U14", target_squad_id: 2,
  head_coach_id: 5, coach_name: "Host coach", can_manage: false, can_arrange: false, proposals: [], appointments: [appointment], own_appointments: [],
  home_score: null, away_score: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useClock).mockReturnValue(Date.parse("2099-09-01T00:00:00Z"));
  vi.mocked(useAction).mockReturnValue({ busy: false, run: vi.fn(), feedback: <></> });
});

it("places match summary and readiness before secondary administration in document order", () => {
  vi.mocked(useLoad).mockImplementation((path: string) => ({ data: path === "/match-exchange/12" ? match : [], error: "", reload: vi.fn() }));
  render(<MemoryRouter initialEntries={["/match-exchange/12"]}><Routes><Route path="/match-exchange/:eventId" element={<MatchDetailPage />} /></Routes></MemoryRouter>);

  const readiness = screen.getByRole("region", { name: "Match readiness and next action" });
  const details = screen.getByRole("heading", { name: "Match details" }).closest("section")!;
  const secondary = screen.getByText("About match updates").closest("aside")!;
  expect(details.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(details.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("marks an invitation card for priority presentation without changing its actions", () => {
  const { container } = render(<MemoryRouter><AppointmentCard appointment={appointment} reload={vi.fn()} /></MemoryRouter>);
  expect(container.querySelector(".mx-appointment")).toHaveClass("is-invited");
  expect(screen.getByRole("button", { name: "Accept invitation" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Decline invitation" })).toBeEnabled();
});

it("shows the match identity, zoned schedule and readiness once before the detail route", () => {
  vi.mocked(useLoad).mockImplementation((path: string) => path === "/match-exchange/squads"
    ? { data: [], error: "", reload: vi.fn() }
    : { data: { items: [{ ...match, listing_status: "OPEN", opponent_name: null, opponent_club_id: null, opponent_squad_name: null, target_squad_id: null }], total: 1 }, error: "", reload: vi.fn() });
  render(<MemoryRouter initialEntries={["/match-exchange"]}><MatchExchangePage /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "1 matches" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Home Academy/ })).toHaveAttribute("href", "/clubs/1");
  expect(screen.getByText("U14")).toBeInTheDocument();
  expect(screen.getByText(/14:00 – 15:30/)).toHaveTextContent("Asia/Tbilisi");
  expect(screen.getByText("Host confirmed")).toBeInTheDocument();
  expect(screen.queryByText(match.description!)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View match details" })).toHaveAttribute("href", "/match-exchange/12");
});
