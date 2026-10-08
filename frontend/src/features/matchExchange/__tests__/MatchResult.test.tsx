import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MatchResult } from "../MatchResult";
import { getMatchResult, writeMatchResult, type Match, type MatchResultState } from "../api";

vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ sessionId: "session-a" }) }));
vi.mock("../api", async importOriginal => ({ ...(await importOriginal<typeof import("../api")>()), getMatchResult: vi.fn(), writeMatchResult: vi.fn() }));

const match = { event_id: 12, club_name: "Home FC", opponent_name: "Away FC", event_status: "SCHEDULED" } as Match;
const authority: MatchResultState["authority"] = { roles: ["HOME"], canPropose: true, canCorrect: false, canDispute: false, confirmableRoles: [], correctableRoles: [] };
const state = (override: Partial<MatchResultState> = {}): MatchResultState => ({
  eventId: 12, status: "NONE", revision: 3, homeScore: null, awayScore: null, proposalSide: null,
  requiredConfirmations: [], confirmations: [], legacy: false, authority, history: [], ...override,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMatchResult).mockResolvedValue(state());
  vi.mocked(writeMatchResult).mockResolvedValue(state({ status: "PROPOSED", revision: 4, homeScore: 2, awayScore: 1, proposalSide: "HOME", requiredConfirmations: ["AWAY", "REFEREE"] }));
});

it("proposes a score using its result revision and shows pending confirmations", async () => {
  const reload = vi.fn();
  render(<MatchResult match={match} reload={reload}/>);
  await screen.findByRole("heading", { name: "Propose a score" });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Home FC score" }), { target: { value: "2" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Away FC score" }), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Propose score" }));
  await waitFor(() => expect(writeMatchResult).toHaveBeenCalledWith(12, "propose", expect.objectContaining({ homeScore: 2, awayScore: 1, side: "HOME", revision: 3, requestId: expect.any(String) }), expect.any(AbortSignal), "session-a"));
  expect(await screen.findByText(/Proposed score: 2 – 1/)).toBeInTheDocument();
  expect(screen.getByText(/Still needed: Away team, Lead referee/)).toBeInTheDocument();
  expect(screen.queryByText(/Final score/)).not.toBeInTheDocument();
  expect(reload).toHaveBeenCalledTimes(1);
});

it("only offers server-authorized confirmation roles", async () => {
  vi.mocked(getMatchResult).mockResolvedValue(state({ status: "PROPOSED", homeScore: 2, awayScore: 1, proposalSide: "HOME", requiredConfirmations: ["AWAY", "REFEREE"], authority: { ...authority, roles: ["AWAY"], canPropose: false, canCorrect: true, canDispute: true, confirmableRoles: ["AWAY"], correctableRoles: ["AWAY"] } }));
  render(<MatchResult match={match} reload={vi.fn()}/>);
  const confirm = await screen.findByRole("button", { name: "Confirm as Away team" });
  expect(screen.queryByRole("button", { name: "Confirm as Home team" })).not.toBeInTheDocument();
  fireEvent.click(confirm);
  await waitFor(() => expect(writeMatchResult).toHaveBeenCalledWith(12, "confirm", expect.objectContaining({ side: "AWAY", revision: 3 }), expect.any(AbortSignal), "session-a"));
});

it("allows an authorized correction after completion and sends its required reason", async () => {
  vi.mocked(getMatchResult).mockResolvedValue(state({ status: "CONFIRMED", revision: 8, homeScore: 2, awayScore: 1, authority: { ...authority, canPropose: false, canCorrect: true, canDispute: false, correctableRoles: ["HOME"] } }));
  render(<MatchResult match={{ ...match, event_status: "COMPLETED" }} reload={vi.fn()}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Propose correction" }));
  const button = screen.getByRole("button", { name: "Submit correction" });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Home FC score" }), { target: { value: "3" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Reason for correction" }), { target: { value: "Scorecard entry corrected" } });
  fireEvent.click(button);
  await waitFor(() => expect(writeMatchResult).toHaveBeenCalledWith(12, "correct", expect.objectContaining({ homeScore: 3, awayScore: 1, side: "HOME", revision: 8, reason: "Scorecard entry corrected" }), expect.any(AbortSignal), "session-a"));
});

it("shows legacy provenance and permits authorized recovery when an old completed fixture has no result row", async () => {
  vi.mocked(getMatchResult).mockResolvedValue(state({ status: "CONFIRMED", legacy: true, homeScore: 1, awayScore: 0, authority: { ...authority, canPropose: false, canCorrect: true, correctableRoles: ["HOME"] } }));
  const { rerender } = render(<MatchResult match={{ ...match, event_status: "COMPLETED" }} reload={vi.fn()}/>);
  expect(await screen.findByText(/Confirmation evidence is unavailable/)).toBeInTheDocument();
  expect(screen.queryByText(/^Confirmed result/)).not.toBeInTheDocument();
  vi.mocked(getMatchResult).mockResolvedValue(state({ authority: { ...authority, canPropose: false, canCorrect: true, correctableRoles: ["HOME"] } }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh result" }));
  rerender(<MatchResult match={{ ...match, event_status: "COMPLETED" }} reload={vi.fn()}/>);
  expect(await screen.findByRole("button", { name: "Propose correction" })).toBeInTheDocument();
});

it("clears an open draft when a refreshed result has a newer revision", async () => {
  vi.mocked(getMatchResult).mockResolvedValueOnce(state()).mockResolvedValueOnce(state({ revision: 4, status: "PROPOSED", homeScore: 3, awayScore: 2, proposalSide: "AWAY" }));
  render(<MatchResult match={match} reload={vi.fn()}/>);
  await screen.findByRole("heading", { name: "Propose a score" });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Home FC score" }), { target: { value: "2" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Away FC score" }), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh result" }));
  expect(await screen.findByText(/Review the latest version before editing again/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Propose score" })).not.toBeInTheDocument();
  expect(writeMatchResult).not.toHaveBeenCalled();
});

it("shows a disputed score as under review and retains reasoned history on a cancelled match", async () => {
  vi.mocked(getMatchResult).mockResolvedValue(state({ status: "DISPUTED", homeScore: 2, awayScore: 1, history: [{ id: 5, action: "DISPUTE", actor_id: 8, actor_side: "AWAY", home_score: 2, away_score: 1, previous_home_score: 2, previous_away_score: 1, previous_status: "CONFIRMED", status: "DISPUTED", reason: "Wrong away goal", created_at: "2026-09-22T10:00:00Z", revision: 5 }], authority: { ...authority, canPropose: false, canCorrect: true, canDispute: true, correctableRoles: ["HOME"] } }));
  render(<MatchResult match={{ ...match, event_status: "CANCELLED" }} reload={vi.fn()}/>);
  expect(await screen.findByText(/Result disputed/)).toBeInTheDocument();
  expect(screen.getByText(/disputed score: 2 – 1/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Propose correction" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Result history (1)"));
  expect(screen.getByText("Wrong away goal")).toBeInTheDocument();
});

it("uses fresh result fixture status to stop actions when the match page still says scheduled", async () => {
  vi.mocked(getMatchResult).mockResolvedValue(state({ fixtureStatus: "CANCELLED", status: "PROPOSED", homeScore: 2, awayScore: 1, proposalSide: "HOME", requiredConfirmations: ["AWAY"], authority: { ...authority, roles: ["AWAY"], canPropose: false, canCorrect: true, canDispute: true, confirmableRoles: ["AWAY"], correctableRoles: ["AWAY"] } }));
  render(<MatchResult match={match} reload={vi.fn()}/>);
  expect(await screen.findByText(/cancelled fixture’s result history is read only/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm as Away team" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dispute result" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Propose correction" })).not.toBeInTheDocument();
});

it("reloads a stale revision and asks for review after a conflict", async () => {
  vi.mocked(writeMatchResult).mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  render(<MatchResult match={match} reload={vi.fn()}/>);
  await screen.findByRole("heading", { name: "Propose a score" });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Home FC score" }), { target: { value: "2" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Away FC score" }), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Propose score" }));
  expect(await screen.findByText(/Review the latest version/)).toBeInTheDocument();
  await waitFor(() => expect(getMatchResult).toHaveBeenCalledTimes(2));
});
