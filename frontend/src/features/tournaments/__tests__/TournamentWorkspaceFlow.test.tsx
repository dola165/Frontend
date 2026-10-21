import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import "../../../i18n";
import type {
  TournamentDetail,
  TournamentEntryDto,
  TournamentFixtureDto,
} from "../domain";
import { TournamentBracketBoard } from "../components/TournamentBracketBoard";
import { TournamentCompetition } from "../components/TournamentCompetition";
import { TournamentParticipants } from "../components/TournamentParticipants";
import { TournamentMatchDialog } from "../components/TournamentMatchDialog";
import {
  addGuestEntry,
  completeFixture,
  createStage,
  placeTournamentEntry,
  scheduleTournamentFixture,
} from "../api";

vi.mock("../api", () => ({
  addGuestEntry: vi.fn(),
  createStage: vi.fn(),
  placeTournamentEntry: vi.fn(),
  unplaceTournamentEntry: vi.fn(),
  randomizeStageBracket: vi.fn(),
  completeFixture: vi.fn(),
  scheduleTournamentFixture: vi.fn(),
  updateFixtureScores: vi.fn(),
  cancelFixture: vi.fn(),
  reopenFixture: vi.fn(),
  removeEntry: vi.fn(),
  updateEntryStatus: vi.fn(),
}));
vi.mock("../components/TournamentInvitationsPanel", () => ({
  TournamentInvitationsPanel: () => <div>Invitations</div>,
}));
vi.mock("../components/CreateTeamModal", () => ({
  CreateTeamModal: () => <div>Build team</div>,
}));
vi.mock("../components/StandingsTable", () => ({
  StandingsTable: () => <div>Standings</div>,
}));

const entry = (
  id: number,
  name: string,
  extra: Partial<TournamentEntryDto> = {},
): TournamentEntryDto => ({
  id,
  displayName: name,
  clubId: null,
  clubName: null,
  squadId: null,
  squadName: null,
  userId: null,
  status: "ACTIVE",
  seed: null,
  requestedBy: null,
  decidedBy: null,
  decidedAt: null,
  confirmedAt: null,
  withdrawnAt: null,
  withdrawalReason: null,
  ...extra,
});
const fixture = (
  id: number,
  home: number | null,
  away: number | null,
  extra: Partial<TournamentFixtureDto> = {},
): TournamentFixtureDto => ({
  id,
  stageId: 10,
  stageName: "Cup",
  homeEntryId: home,
  awayEntryId: away,
  homeLabel: null,
  awayLabel: null,
  winnerEntryId: null,
  homeScore: null,
  awayScore: null,
  roundNumber: 1,
  fixtureOrder: id,
  status: "SCHEDULED",
  scheduledAt: null,
  locationId: null,
  linkedMatchId: null,
  ...extra,
});
const tournament = (
  extra: Partial<TournamentDetail> = {},
): TournamentDetail => ({
  id: 7,
  name: "Community Cup",
  organizerName: "Health Partners",
  organizerOrganizationId: 8,
  participantScope: "CLUB",
  visibility: "PUBLIC",
  status: "PLANNING",
  staffAssignments: [],
  entries: [entry(1, "Riverside"), entry(2, "Hill FC"), entry(3, "North FC")],
  stages: [
    {
      id: 10,
      name: "Cup",
      stageType: "KNOCKOUT",
      stageOrder: 1,
      status: "PLANNING",
      parentStageId: null,
      advanceCount: null,
    },
  ],
  fixtures: [
    fixture(1, 1, 2),
    fixture(2, null, null),
    fixture(3, null, null, { roundNumber: 2, fixtureOrder: 1 }),
  ],
  ...extra,
});

beforeEach(() => vi.clearAllMocks());

describe("inline bracket results", () => {
  const live = () => tournament({ status: "ACTIVE" });
  it("adds goals and saves a provisional score directly on the card", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const advance = vi.fn();
    render(
      <TournamentBracketBoard
        tournament={live()}
        canScore
        onSaveScore={save}
        onAdvance={advance}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add goal for Riverside" }),
    );
    expect(
      screen.getByRole("spinbutton", { name: "Score for Riverside" }),
    ).toHaveValue(1);
    expect(
      screen.getByRole("spinbutton", { name: "Score for Hill FC" }),
    ).toHaveValue(0);
    await userEvent.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        homeScore: 1,
        awayScore: 0,
      }),
    );
    expect(advance).not.toHaveBeenCalled();
  });
  it("keeps score drafts after failure and permits retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={live()}
        canScore
        onSaveScore={save}
        onAdvance={vi.fn()}
      />,
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Score for Riverside" }),
      "3",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save score" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your score is kept here",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Score for Riverside" }),
    ).toHaveValue(3);
    await userEvent.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });
  it("keeps the focused card and announces success when the server returns saved scores", async () => {
    function LiveBoard() {
      const [value, setValue] = useState(live());
      return (
        <TournamentBracketBoard
          tournament={value}
          canScore
          onAdvance={vi.fn()}
          onSaveScore={async (match, scores) => {
            setValue((previous) => ({
              ...previous,
              fixtures: previous.fixtures.map((f) =>
                f.id === match.id
                  ? {
                      ...f,
                      homeScore: scores.homeScore,
                      awayScore: scores.awayScore,
                    }
                  : f,
              ),
            }));
          }}
        />
      );
    }
    render(<LiveBoard />);
    const input = screen.getByRole("spinbutton", {
      name: "Score for Riverside",
    });
    await userEvent.type(input, "2");
    const button = screen.getByRole("button", { name: "Save score" });
    await userEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("Score saved.");
    expect(
      screen.getByRole("spinbutton", { name: "Score for Riverside" }),
    ).toBe(input);
    expect(screen.getByRole("button", { name: "Save score" })).toBe(button);
    expect(button).toHaveFocus();
  });
  it("advances with scores and prevents advancing the lower-scoring team", async () => {
    const advance = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={live()}
        canScore
        onSaveScore={vi.fn()}
        onAdvance={advance}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add goal for Riverside" }),
    );
    expect(
      screen.getByRole("button", { name: "Advance Hill FC" }),
    ).toBeDisabled();
    await userEvent.click(
      screen.getByRole("button", { name: "Advance Riverside" }),
    );
    await waitFor(() =>
      expect(advance).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        winnerEntryId: 1,
        homeScore: 1,
        awayScore: 0,
      }),
    );
  });
  it("allows an explicit penalty winner at a tied score", async () => {
    const advance = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={live()}
        canScore
        onSaveScore={vi.fn()}
        onAdvance={advance}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add goal for Riverside" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add goal for Hill FC" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Advance Hill FC" }),
    );
    await waitFor(() =>
      expect(advance).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        winnerEntryId: 2,
        homeScore: 1,
        awayScore: 1,
      }),
    );
  });
  it("accepts winner dragging only into that match's next-round spot", async () => {
    const advance = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={live()}
        canScore
        onSaveScore={vi.fn()}
        onAdvance={advance}
      />,
    );
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(
      screen.getByRole("button", { name: "Riverside · R1 Match 1 HOME" }),
      { dataTransfer },
    );
    fireEvent.drop(
      screen.getByRole("button", { name: /Winner of R1 · Match 2/ }),
      { dataTransfer },
    );
    expect(advance).not.toHaveBeenCalled();
    fireEvent.drop(
      screen.getByRole("button", { name: /Winner of R1 · Match 1/ }),
      { dataTransfer },
    );
    await waitFor(() =>
      expect(advance).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), {
        winnerEntryId: 1,
        homeScore: null,
        awayScore: null,
      }),
    );
  });
  it("keeps public, unstarted, linked, and unfinished feeder matches read-only", () => {
    const value = live();
    const { rerender } = render(
      <TournamentBracketBoard
        tournament={value}
        onSaveScore={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    rerender(
      <TournamentBracketBoard
        tournament={tournament()}
        canScore
        onSaveScore={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    rerender(
      <TournamentBracketBoard
        tournament={{
          ...value,
          fixtures: [
            fixture(1, 1, 2, { linkedMatchId: 9 }),
            fixture(3, 1, 2, { roundNumber: 2, fixtureOrder: 1 }),
          ],
        }}
        canScore
        onSaveScore={vi.fn()}
        onAdvance={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });
});

describe("simple bracket placement", () => {
  it("uses the organizer's round name for legacy stages without round numbers", () => {
    const value = tournament();
    render(
      <TournamentBracketBoard
        tournament={{
          ...value,
          stages: [{ ...value.stages[0], name: "Quarter Finals" }],
          fixtures: [
            fixture(1, 1, 2, { roundNumber: null }),
            fixture(2, 3, null, { roundNumber: null }),
          ],
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Quarter Finals" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^Final$/ }),
    ).not.toBeInTheDocument();
  });
  it("returns a placed team to the pool without removing the participant", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={vi.fn()}
        onRemove={remove}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Riverside.*top spot/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Return team to pool" }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith(1, 1, "HOME"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Team returned to the participant pool",
    );
  });
  it("places a selected guest with buttons without requiring a drag", async () => {
    const place = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={place}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /North FC Select/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Open spot.*R1 Match 2 top spot/ }),
    );
    await waitFor(() => expect(place).toHaveBeenCalledWith(3, 2, "HOME"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Bracket updated",
    );
  });
  it("offers occupied teams in the slot chooser for an atomic swap", async () => {
    const place = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={place}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Riverside.*top spot/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Hill FC Move \/ swap/,
      }),
    );
    await waitFor(() => expect(place).toHaveBeenCalledWith(2, 1, "HOME"));
  });
  it("uses the same placement action for mouse dragging", async () => {
    const place = vi.fn().mockResolvedValue(undefined);
    render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={place}
      />,
    );
    const source = screen.getByRole("button", { name: /Riverside.*top spot/ });
    const destination = screen.getByRole("button", {
      name: /Open spot.*R1 Match 2 bottom spot/,
    });
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(destination, { dataTransfer });
    fireEvent.drop(destination, { dataTransfer });
    await waitFor(() => expect(place).toHaveBeenCalledWith(1, 2, "AWAY"));
  });
  it("retains the chooser and error after a failed move", async () => {
    const place = vi
      .fn()
      .mockRejectedValue(new Error("Locked by another organizer"));
    render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={place}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Riverside.*top spot/ }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Hill FC Move \/ swap/,
      }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("keeps later rounds and public slots out of placement mode", () => {
    const place = vi.fn();
    const { rerender } = render(
      <TournamentBracketBoard
        tournament={tournament()}
        canManage
        onPlace={place}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Winner of R1 · Match 1/ }),
    ).toBeDisabled();
    rerender(
      <TournamentBracketBoard tournament={tournament()} onPlace={place} />,
    );
    expect(screen.queryByText("Ready to place")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Riverside/ })).toBeDisabled();
    expect(place).not.toHaveBeenCalled();
  });
  it("requires activation before an approved team can enter the draw", () => {
    render(
      <TournamentBracketBoard
        tournament={tournament({
          entries: [
            entry(4, "Still awaiting confirmation", { status: "APPROVED" }),
          ],
        })}
        canManage
        onPlace={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Still awaiting confirmation"),
    ).not.toBeInTheDocument();
  });
});

describe("organizer workflow", () => {
  it("recommends a two-team draw after teams are added to an initially empty tournament", async () => {
    const props = { canManage: true, onUpdate: vi.fn(), onMatch: vi.fn() };
    const { rerender } = render(
      <TournamentCompetition
        tournament={tournament({ entries: [], fixtures: [], stages: [] })}
        {...props}
      />,
    );
    rerender(
      <TournamentCompetition
        tournament={tournament({
          entries: [entry(1, "A"), entry(2, "B")],
          fixtures: [],
          stages: [],
        })}
        {...props}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create the competition" }),
    );
    expect(
      screen.getByRole("combobox", { name: /Number of places/ }),
    ).toHaveValue("2");
  });
  it("adds a guest club by name without building a player roster", async () => {
    const value = tournament();
    const update = vi.fn();
    vi.mocked(addGuestEntry).mockResolvedValue(value);
    render(
      <TournamentParticipants
        tournament={value}
        canManage
        onUpdate={update}
        onRefresh={vi.fn()}
        onBracket={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add participants" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Club or team name" }),
      "Community XI",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add guest club" }),
    );
    await waitFor(() =>
      expect(addGuestEntry).toHaveBeenCalledWith(7, "Community XI"),
    );
    expect(update).toHaveBeenCalledWith(value);
    expect(screen.queryByText("Build team")).not.toBeInTheDocument();
  });
  it("fills one side of every opening match before assigning opponents", async () => {
    const value = tournament({
      entries: [1, 2, 3, 4, 5, 6].map((id) => entry(id, `Team ${id}`)),
      fixtures: [1, 2, 3, 4].map((id) => fixture(id, null, null)),
    });
    vi.mocked(placeTournamentEntry).mockResolvedValue(value);
    render(
      <TournamentCompetition
        tournament={value}
        canManage
        onUpdate={vi.fn()}
        onMatch={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Place teams for me" }),
    );
    await waitFor(() => expect(placeTournamentEntry).toHaveBeenCalledTimes(6));
    expect(
      vi
        .mocked(placeTournamentEntry)
        .mock.calls.map((call) => [call[1], call[3]]),
    ).toEqual([
      [1, "HOME"],
      [2, "HOME"],
      [3, "HOME"],
      [4, "HOME"],
      [1, "AWAY"],
      [2, "AWAY"],
    ]);
  });
  it("preserves the created shell if automatic placement fails", async () => {
    const value = tournament({ stages: [], fixtures: [] });
    const created = tournament();
    const update = vi.fn();
    vi.mocked(createStage).mockResolvedValue(created);
    vi.mocked(placeTournamentEntry).mockRejectedValue(
      new Error("Connection interrupted"),
    );
    render(
      <TournamentCompetition
        tournament={value}
        canManage
        onUpdate={update}
        onMatch={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add competition stage" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create competition stage",
      }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith(created);
    expect(createStage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("allows scheduling but no score submission before tournament start", async () => {
    const value = tournament({
      startDate: "2026-10-01T10:00:00",
      endDate: "2026-10-05T18:00:00",
    });
    vi.mocked(scheduleTournamentFixture).mockResolvedValue(value);
    render(
      <TournamentMatchDialog
        tournament={value}
        fixture={value.fixtures[0]}
        canManage
        canScore
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Save score" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm final result" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kickoff"), {
      target: { value: "2026-10-02T14:30" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save kickoff" }));
    expect(scheduleTournamentFixture).toHaveBeenCalledWith(
      7,
      1,
      "2026-10-02T14:30:00",
      null,
    );
  });
  it("requires an explicit penalty winner for a tied knockout result", async () => {
    const value = tournament({ status: "ACTIVE" });
    vi.mocked(completeFixture).mockResolvedValue(value);
    render(
      <TournamentMatchDialog
        tournament={value}
        fixture={value.fixtures[0]}
        canManage
        canScore
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Home score"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Away score"), {
      target: { value: "1" },
    });
    expect(
      screen.getByRole("button", { name: "Confirm final result" }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Winner after penalties" }),
      "2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm final result" }),
    );
    expect(completeFixture).toHaveBeenCalledWith(7, 1, {
      homeScore: 1,
      awayScore: 1,
      winnerEntryId: 2,
    });
  });
});
