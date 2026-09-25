import { createRoot } from "react-dom/client";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiClient } from "../../../api/axiosConfig";
import { MatchDetailPage } from "../../../pages/MatchDetailPage";
import { MatchExchangePage } from "../../../pages/MatchExchangePage";
import { RefereePage } from "../../../pages/RefereePage";
import type { Appointment, ChangeImpact, Match, RefereeHub } from "../api";
import "../../../index.css";
import "../../../styles/product-identity.css";

// Explicit local QA entry only. No auth session, service request or production feature flag.
if (!import.meta.env.DEV || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) throw new Error("Local development fixture only");
const params = new URLSearchParams(location.search), scenario = params.get("case") || "invited";
const language = params.get("lang") === "ka" ? "ka" : "en", dark = params.get("theme") === "dark";
const surface = params.get("surface") === "workspace" ? "workspace" : params.get("surface") === "browse" ? "browse" : "detail";
const clean = params.get("clean") === "1";
document.documentElement.classList.toggle("dark", dark);
document.documentElement.lang = language;
const i18n = createInstance();
await i18n.init({ lng: language, fallbackLng: "en", resources: { en: { translation: {} }, ka: { translation: {} } } });
const late = ["late", "host-started", "cancelled"].includes(scenario);
const start = new Date(Date.now() + (late ? -30 * 60_000 : 2 * 86_400_000));
const end = new Date(start.getTime() + 90 * 60_000);
const appointment: Appointment = {
  id: 91, event_id: 12, referee_id: 8, full_name: "Synthetic referee", title: "სინთეზური ამხანაგური მატჩი · Friendly",
  duty: "REFEREE", status: ["accepted", "late"].includes(scenario) ? "ACCEPTED" : "INVITED",
  volunteer: false, fee: 50, currency: "GEL", report: null, report_submitted_at: null,
  starts_at: start.toISOString().slice(0,19), ends_at: end.toISOString().slice(0,19), starts_at_iso: start.toISOString(), ends_at_iso: end.toISOString(),
  timezone: "Asia/Tbilisi", event_status: "SCHEDULED", club_name: "Synthetic home", opponent_name: "Synthetic away", location_name: "Local test ground",
  invited_by_name: "Synthetic coach", venue_status: "HOST_CONFIRMED",
  allowed_actions: scenario === "late" ? ["REPORT_INABILITY"] : scenario === "accepted" ? ["WITHDRAW"] : scenario === "availability" ? ["DECLINE"] : ["ACCEPT", "DECLINE"],
  acceptance_blocker: scenario === "availability" ? "AVAILABILITY_REQUIRED" : scenario === "late" ? "KICKOFF_PASSED" : null,
};
const staff = ["host", "host-started", "cancelled", "opponent"].includes(scenario), owner = !staff && scenario !== "family";
const match: Match = {
  event_id: 12, squad_id: 1, squad_name: "U14", club_id: 1, club_name: "Synthetic home", club_profile_kind: "ACADEMY", club_logo_url: null, club_banner_url: null,
  title: appointment.title, description: "Synthetic local fixture for appointment, cancellation and venue follow-up review.",
  starts_at: appointment.starts_at, ends_at: appointment.ends_at, starts_at_iso: appointment.starts_at_iso, ends_at_iso: appointment.ends_at_iso, timezone: appointment.timezone,
  city: "Tbilisi", location_name: appointment.location_name, location_lat: null, location_lng: null, age_group: "U14", level: "DEVELOPMENT", format: "7_A_SIDE", venue_preference: "HOME", referee_required: true,
  venue_id: null, booking_id: null, external_venue_confirmed: true, revision: 7, listing_status: scenario === "cancelled" ? "CLOSED" : "ARRANGED", event_status: scenario === "cancelled" ? "CANCELLED" : "SCHEDULED",
  venue_status: scenario === "cancelled" ? "NEEDS_ATTENTION" : "HOST_CONFIRMED", referee_status: scenario === "host-started" ? "REPLACEMENT_NEEDED" : appointment.status,
  opponent_name: "Synthetic away", opponent_club_id: 2, opponent_squad_name: "U14", target_squad_id: 2, head_coach_id: 5, coach_name: "Synthetic coach",
  can_manage: staff && scenario !== "opponent", can_arrange: staff, proposals: [], own_appointments: owner ? [appointment] : [],
  appointments: owner ? [appointment] : [{ ...appointment, status: "ACCEPTED", fee: staff ? 50 : null, currency: staff ? "GEL" : null, attendance_issue: scenario === "host-started" ? "Travel interrupted" : null }],
  home_score: null, away_score: null, history: staff ? [{ id: 1, action: "VENUE", created_at: new Date().toISOString(), reason: "Ground confirmed directly" }] : undefined,
};
const browseMatches: Match[] = scenario === "empty" ? [] : [
  {
    ...match,
    event_id: 21,
    title: "U14 development friendly in Tbilisi",
    description: "Looking for a balanced, development-first match. Flexible on kickoff within the listed afternoon window.",
    listing_status: "OPEN",
    opponent_name: null,
    opponent_club_id: null,
    opponent_squad_name: null,
    target_squad_id: null,
    referee_status: "NEEDED",
    can_manage: false,
    can_arrange: false,
    appointments: [],
    own_appointments: [],
    history: undefined,
  },
  {
    ...match,
    event_id: 22,
    squad_id: 4,
    squad_name: "U16 Blue",
    club_id: 4,
    club_name: "Rustavi Youth Academy",
    title: "U16 competitive 11-a-side opponent wanted",
    description: "We can travel within the Tbilisi and Rustavi area and prefer a full-size pitch.",
    starts_at: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 19),
    ends_at: new Date(Date.now() + 6 * 86_400_000 + 105 * 60_000).toISOString().slice(0, 19),
    starts_at_iso: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    ends_at_iso: new Date(Date.now() + 6 * 86_400_000 + 105 * 60_000).toISOString(),
    city: "Rustavi",
    location_name: "Venue to be agreed",
    age_group: "U16",
    level: "COMPETITIVE",
    format: "11_A_SIDE",
    venue_preference: "AWAY",
    listing_status: "OPEN",
    opponent_name: null,
    opponent_club_id: null,
    opponent_squad_name: null,
    target_squad_id: null,
    referee_status: "NEEDED",
    can_manage: false,
    can_arrange: false,
    appointments: [],
    own_appointments: [],
    history: undefined,
  },
];
const hub: RefereeHub = { profile: { user_id: 8, full_name: "Synthetic referee", published: true, biography: "", qualifications: "", formats: "7_A_SIDE", languages: "English, ქართული", service_area: "Tbilisi", travel_km: 30, accepts_paid: true, accepts_volunteer: true, fee: 50, currency: "GEL", timezone: "Asia/Tbilisi", revision: 0 }, availability: [], appointments: [appointment] };
// The adapter handles all calls from these mounted surfaces in memory. Clearing interceptors
// prevents fixture actions from refreshing or reading an actual signed-in session.
apiClient.interceptors.request.clear(); apiClient.interceptors.response.clear();
apiClient.defaults.adapter = async config => {
  const path = config.url || "", body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
  let data: unknown = {};
  if (config.method === "get") {
    if (path === "/match-exchange/12") data = match;
    else if (path === "/match-exchange/21" || path === "/match-exchange/22") data = browseMatches.find(item => path === `/match-exchange/${item.event_id}`);
    else if (path.split("?")[0] === "/match-exchange") data = { items: browseMatches, total: browseMatches.length };
    else if (path === "/referees/me") data = hub;
    else if (path === "/match-exchange/squads" || path === "/venues/bookings/mine") data = [];
    else if (path.startsWith("/referees")) data = { items: [] };
    else throw new Error(`Unsupported local fixture GET: ${path}`);
  } else if (path.endsWith("/decision")) {
    appointment.status = body.action === "ACCEPT" ? "ACCEPTED" : body.action === "WITHDRAW" ? "WITHDRAWN" : "DECLINED";
    appointment.allowed_actions = appointment.status === "ACCEPTED" ? ["WITHDRAW"] : [];
    match.referee_status = appointment.status === "WITHDRAWN" ? "REPLACEMENT_NEEDED" : appointment.status;
  } else if (path.endsWith("/attendance-issue")) {
    appointment.attendance_issue = body.reason; appointment.allowed_actions = []; match.referee_status = "REPLACEMENT_NEEDED";
  } else if (path.endsWith("/close-preview")) {
    data = { action: "CANCEL", revision: match.revision, material: true, changedFields: ["status"], confirmationRequired: true, confirmationToken: "LOCAL-FIXTURE-ONLY", dependencies: [{ domain: "EXTERNAL_VENUE", id: null, state: "HOST_CONFIRMED", consequence: "PRESERVE_UNTIL_HOST_RESOLVES" }], needsAttention: [{ code: "RESOLVE_EXTERNAL_VENUE", id: null, message: "Contact the ground owner; original confirmation stays in history.", blocking: false }] } satisfies ChangeImpact;
  } else if (path.endsWith("/close")) { match.event_status = "CANCELLED"; match.listing_status = "CLOSED"; match.venue_status = "NEEDS_ATTENTION"; match.revision++; }
  else if (path.endsWith("/external-venue-resolution")) { match.venue_status = "RESOLVED"; match.revision++; }
  else if (path.endsWith("/report")) appointment.report = body.body;
  else throw new Error(`Unsupported local fixture request: ${config.method || "unknown"} ${path}`);
  return { data: structuredClone(data), status: 200, statusText: "OK", headers: {}, config };
};
createRoot(document.getElementById("root")!).render(<I18nextProvider i18n={i18n}>
  {!clean && <div className="mx-page"><strong>LOCAL SYNTHETIC FIXTURE — no service writes</strong><nav className="mx-actions" aria-label="Fixture scenarios">
    {["invited", "availability", "accepted", "late", "host", "host-started", "cancelled", "opponent", "family", "empty"].map(value => <a key={value} href={`?case=${value}&theme=${dark ? "dark" : "light"}&lang=${language}&surface=${surface}`}>{value}</a>)}
  </nav></div>}
  <MemoryRouter initialEntries={[surface === "workspace" ? "/referees/me#appointment-91" : surface === "browse" ? "/match-exchange" : "/match-exchange/12#appointment-91"]}><Routes>
    <Route path="/match-exchange" element={<MatchExchangePage />} /><Route path="/match-exchange/:eventId" element={<MatchDetailPage />} /><Route path="/referees/:refereeId" element={<RefereePage />} />
    <Route path="*" element={<main className="mx-page">This destination is outside the isolated fixture.</main>} />
  </Routes></MemoryRouter>
</I18nextProvider>);
