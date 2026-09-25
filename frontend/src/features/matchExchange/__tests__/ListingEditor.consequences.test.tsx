import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingEditor } from "../ListingEditor";
import { put, type Match, type ChangeImpact } from "../api";

vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), put: vi.fn() }));
vi.mock("../hooks", async (original) => ({
  ...await original<typeof import("../hooks")>(),
  useLoad: (path: string) => ({ data: path.includes("squads") ? [{ id: 1, club_id: 1, name: "U12", club_name: "Home" }] : { content: [] } }),
}));

const match = {
  event_id: 12, squad_id: 1, title: "Original", description: "Rules", revision: 4,
  starts_at: "2027-01-01T12:00:00", ends_at: "2027-01-01T13:00:00", timezone: "UTC",
  city: "Test City", location_name: "Ground", age_group: "U12", level: "DEVELOPMENT",
  format: "7_A_SIDE", venue_preference: "HOME", referee_required: true, venue_id: null,
  location_lat: null, location_lng: null,
} as Match;
const impact: ChangeImpact = {
  action: "REVISE", revision: 4, material: true, changedFields: ["description"],
  dependencies: [{ domain: "OPPONENT", id: 2, state: "ACCEPTED", consequence: "REOPEN_REQUIRE_NEW_AGREEMENT" }],
  needsAttention: [], confirmationRequired: true, confirmationToken: "current-impact",
};
const attentionError = (value = impact) => ({ isAxiosError: true, response: { data: { code: "MATCH_CHANGE_NEEDS_ATTENTION", error: "Review arrangements", impact: value } } });
const onClose = vi.fn();
function open() {
  render(<MemoryRouter><ListingEditor initial={match} onClose={onClose} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Match details"), { target: { value: "New rules" } });
}

describe("match revision consequences", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it("keeps the draft open on attention and confirms the same terms with the returned token", async () => {
    vi.mocked(put).mockRejectedValueOnce(attentionError()).mockResolvedValueOnce({ event_id: 12 });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Review and save changes" }));
    await screen.findByRole("button", { name: "Confirm changes and notify participants" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Match details")).toHaveValue("New rules");
    expect(screen.getByText(/opponent must agree again/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm changes and notify participants" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(vi.mocked(put).mock.calls[1][2]).toBe("current-impact");
    expect(vi.mocked(put).mock.calls[1][1]).toEqual(vi.mocked(put).mock.calls[0][1]);
  });

  it("discards impact confirmation when the draft changes", async () => {
    vi.mocked(put).mockRejectedValue(attentionError()); open();
    fireEvent.click(screen.getByRole("button", { name: "Review and save changes" }));
    await screen.findByRole("button", { name: "Confirm changes and notify participants" });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated title" } });
    fireEvent.click(screen.getByRole("button", { name: "Review and save changes" }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(vi.mocked(put).mock.calls[1][2]).toBeUndefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("explains live booking blockers without closing the editor or claiming success", async () => {
    vi.mocked(put).mockRejectedValue(attentionError({ ...impact, needsAttention: [{ code: "RESOLVE_VENUE_BOOKING", id: 9, message: "Resolve reservation #9 through the stadium booking workflow. It remains linked." }] }));
    open(); fireEvent.click(screen.getByRole("button", { name: "Review and save changes" }));
    await screen.findByText("Resolve these arrangements first");
    expect(screen.getByText(/Resolve reservation #9/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Listing saved")).not.toBeInTheDocument();
  });
});
