import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, it, expect } from "vitest";
import { ExactRefereeAppointment, RefereeOfferHistory } from "../RefereeOutcomeHistory";

vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ sessionId: "session-a" }) }));
const offer = { id: 19, eventId: 12, status: "TERMS_CHANGED", canWithdraw: false, createdAt: "2026-01-01T12:00:00Z", outcomeReason: "The kickoff changed.", appointmentPath: "/referees/me#appointment-91", originalTerms: { volunteer: false, fee: 50, currency: "GEL", title: "U14 friendly", startsAt: "2026-09-01T10:00:00Z", endsAt: "2026-09-01T12:00:00Z", timezone: "Asia/Tbilisi", city: "Tbilisi", locationName: "North pitch", format: "7_A_SIDE" }, changedTerms: { volunteer: false, fee: 75, currency: "GEL", title: "U14 friendly", startsAt: "2026-09-01T11:00:00Z", endsAt: "2026-09-01T13:00:00Z", timezone: "Asia/Tbilisi", city: "Tbilisi", locationName: "North pitch", format: "7_A_SIDE" } };
const appointment = { id: 91, event_id: 12, referee_id: 8, duty: "REFEREE", status: "ACCEPTED", volunteer: true, fee: null, currency: null, report: null, report_submitted_at: null, title: "Exact archived fixture", starts_at: "2026-01-01T10:00:00Z", ends_at: "2026-01-01T12:00:00Z", timezone: "Asia/Tbilisi", event_status: "COMPLETED", starts_at_iso: "2026-01-01T10:00:00Z", ends_at_iso: "2026-01-01T12:00:00Z", club_name: "Alpha", opponent_name: "Beta", location_name: "North pitch", allowed_actions: [] };
vi.mock("../hooks", () => ({ useClock: () => Date.now() }));
vi.mock("../useRefereeHistory", () => ({ useRefereeHistory: (path: string) => ({ data: path === "/referees/me/offers/19" ? offer : path === "/referees/me/appointments/91" ? appointment : { page: 0, total: 1, pageSize: 24, items: [offer] }, error: "", reload: vi.fn() }) }));

it("keeps original terms, changed terms and the exact owned appointment link", () => {
  render(<MemoryRouter initialEntries={["/referees/me#offer-19"]}><RefereeOfferHistory /></MemoryRouter>);
  expect(screen.getByText("Original terms:")).toBeInTheDocument();
  expect(screen.getByText("Current terms:")).toBeInTheDocument();
  expect(screen.getByText("The kickoff changed.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open your appointment" })).toHaveAttribute("href", "/referees/me#appointment-91");
});

it("uses the exact owned-offer endpoint for an offer notification outside the first page", () => {
  render(<MemoryRouter initialEntries={["/referees/me#offer-19"]}><RefereeOfferHistory /></MemoryRouter>);
  expect(screen.getByText("U14 friendly")).toBeInTheDocument();
});

it("uses the exact owned appointment endpoint for an archived appointment link", () => {
  render(<MemoryRouter initialEntries={["/referees/me#appointment-91"]}><ExactRefereeAppointment appointmentId={91} reloadAppointment={vi.fn()} /></MemoryRouter>);
  expect(screen.getByText("Exact archived fixture")).toBeInTheDocument();
});
