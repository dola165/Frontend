import { useRef, useState } from "react";
import { GitBranch, List, Plus, Shuffle, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "../../../components/workspace/useDialogFocus";
import { extractApiErrorMessage } from "../../../utils/apiError";
import {
  createStage,
  completeFixture,
  updateFixtureScores,
  placeTournamentEntry,
  randomizeStageBracket,
  unplaceTournamentEntry,
} from "../api";
import type {
  TournamentDetail,
  TournamentFixtureDto,
  TournamentTieState,
  TournamentStageType,
} from "../domain";
import { TournamentBracketBoard } from "./TournamentBracketBoard";
import { isBracketParticipant, participantName } from "../participantLabels";
import { StandingsTable } from "./StandingsTable";
import { TournamentTieResolution } from "./TournamentTieResolution";

interface Props {
  tournament: TournamentDetail;
  canManage: boolean;
  canScore?: boolean;
  matchesOnly?: boolean;
  onUpdate: (t: TournamentDetail) => void;
  onMatch: (f: TournamentFixtureDto) => void;
  onTieStateChange?: (state: TournamentTieState | null) => void;
  onTieResolved?: () => void | Promise<void>;
}
export function TournamentCompetition({
  tournament,
  canManage,
  canScore = canManage,
  matchesOnly = false,
  onUpdate,
  onMatch,
  onTieStateChange,
  onTieResolved,
}: Props) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) =>
    i18n.language.startsWith("ka") ? ka : en;
  const [stageId, setStageId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<TournamentStageType>("KNOCKOUT");
  const [name, setName] = useState("");
  const count = tournament.entries.filter(isBracketParticipant).length;
  const [size, setSize] = useState(
    String(Math.min(64, Math.max(2, 2 ** Math.ceil(Math.log2(count || 8))))),
  );
  const [autoPlace, setAutoPlace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [boardVersion, setBoardVersion] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(creating, ref, () => {
    if (!busy) setCreating(false);
  });
  const stages = [...tournament.stages].sort(
    (a, b) => a.stageOrder - b.stageOrder,
  );
  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const fixtures = tournament.fixtures.filter(
    (f) => matchesOnly || f.stageId === stage?.id,
  );
  const editable = canManage && tournament.status === "PLANNING";
  const canArrange =
    editable && fixtures.every((f) => f.status === "SCHEDULED");
  const openCreate = () => {
    setSize(
      String(
        count ? Math.min(64, Math.max(2, 2 ** Math.ceil(Math.log2(count)))) : 8,
      ),
    );
    setError("");
    setCreating(true);
  };
  const fill = async (
    value: TournamentDetail,
    targetStage: number,
    shuffle = false,
  ) => {
    const teams = value.entries
      .filter(isBracketParticipant)
      .sort((a, b) => (a.seed ?? a.id) - (b.seed ?? b.id));
    if (shuffle)
      for (let i = teams.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [teams[i], teams[j]] = [teams[j], teams[i]];
      }
    const opening = value.fixtures
      .filter((f) => f.stageId === targetStage && f.roundNumber === 1)
      .sort((a, b) => (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0));
    // Spread teams across all opening matches before adding opponents, so spare slots become byes.
    const slots = (["HOME", "AWAY"] as const).flatMap((slot) =>
      opening.map((f) => ({ fixture: f.id, slot })),
    );
    if (teams.length > slots.length)
      throw new Error(
        copy(
          "This draw has fewer spots than confirmed teams. Create a larger draw before placing everyone.",
          "ბადეში ადგილები დადასტურებულ გუნდებზე ნაკლებია. შექმენით უფრო დიდი ბადე.",
        ),
      );
    let current = value;
    for (let i = 0; i < teams.length; i++) {
      current = await placeTournamentEntry(
        value.id,
        slots[i].fixture,
        teams[i].id,
        slots[i].slot,
      );
      onUpdate(current);
    }
    return current;
  };
  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const nextOrder = Math.max(0, ...stages.map((s) => s.stageOrder)) + 1;
      let current = await createStage(tournament.id, {
        name:
          name.trim() ||
          (type === "KNOCKOUT"
            ? copy("Cup draw", "სათასო ბადე")
            : copy("League table", "ლიგის ცხრილი")),
        stageType: type,
        stageOrder: nextOrder,
        bracketSize: type === "KNOCKOUT" ? Number(size) : null,
        advanceCount: type === "KNOCKOUT" ? null : 0,
      });
      onUpdate(current);
      const created = current.stages.find(
        (s) => !tournament.stages.some((previous) => previous.id === s.id),
      );
      if (created) {
        setStageId(created.id);
        setCreating(false);
        if (autoPlace && count >= 2) {
          if (type === "KNOCKOUT") current = await fill(current, created.id);
          else {
            current = await randomizeStageBracket(tournament.id, created.id);
            onUpdate(current);
          }
        }
      }
      setNotice(
        copy(
          "Competition stage created. You can arrange teams and set match times below.",
          "ბადე შეიქმნა. განალაგეთ გუნდები და დანიშნეთ მატჩების დრო.",
        ),
      );
      setName("");
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not finish preparing the competition. Saved changes are shown below.",
            "ბადის მომზადება ვერ დასრულდა. შენახული ცვლილებები ნაჩვენებია ქვემოთ.",
          ),
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const arrange = async (shuffle = false) => {
    if (!stage || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setBoardVersion((value) => value + 1);
    try {
      if (stage.stageType === "KNOCKOUT")
        await fill(tournament, stage.id, shuffle);
      else onUpdate(await randomizeStageBracket(tournament.id, stage.id));
      setNotice(
        copy(
          "Teams placed. Review the competition before starting.",
          "გუნდები განაწილებულია. დაწყებამდე შეამოწმეთ ბადე.",
        ),
      );
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not finish arranging teams. Saved placements are shown; you can continue manually.",
            "განაწილება ვერ დასრულდა. შენახული ადგილები ნაჩვენებია; გააგრძელეთ ხელით.",
          ),
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const visible = fixtures
    .filter(
      (f) =>
        filter === "all" ||
        (filter === "unscheduled"
          ? f.status === "SCHEDULED" && !f.scheduledAt
          : f.status === filter),
    )
    .sort(
      (a, b) =>
        (a.scheduledAt || "9999").localeCompare(b.scheduledAt || "9999") ||
        (a.roundNumber ?? 1) - (b.roundNumber ?? 1) ||
        (a.fixtureOrder ?? 0) - (b.fixtureOrder ?? 0),
    );
  const label = (id: number | null, fallback: string | null) =>
    participantName(tournament.entries.find((e) => e.id === id)) !== "—"
      ? participantName(tournament.entries.find((e) => e.id === id))
      : fallback || copy("To be decided", "გადასაწყვეტია");
  return (
    <>
      {tournament.status !== "PLANNING" && tournament.status !== "CANCELLED" && <TournamentTieResolution
          tournament={tournament}
          canResolve={canManage && tournament.status === "ACTIVE"}
          canAudit={canManage}
          refreshKey={boardVersion}
          onStateChange={onTieStateChange}
          onResolved={async () => {
            setBoardVersion((value) => value + 1);
            await onTieResolved?.();
          }}
        />}
      {(matchesOnly || !stages.length) && (
        <div className="tw-toolbar">
          <div>
            <h2>
              {matchesOnly
                ? copy("Matches & results", "მატჩები და შედეგები")
                : copy("Competition", "შეჯიბრება")}
            </h2>
            <p>
              {matchesOnly
                ? copy(
                    "Set kickoff times and record results in one place.",
                    "დანიშნეთ დრო და ჩაწერეთ შედეგები ერთ სივრცეში.",
                  )
                : copy(
                    "Choose a format, place the teams, and follow their progress.",
                    "აირჩიეთ ფორმატი, განალაგეთ გუნდები და მიჰყევით მათ პროგრესს.",
                  )}
            </p>
          </div>
          {editable && !matchesOnly && (
            <button className="tw-button" disabled={busy} onClick={openCreate}>
              <Plus size={15} />
              {copy("Add competition stage", "შეჯიბრების ეტაპის დამატება")}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="tw-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="tw-notice" role="status">
          {notice}
        </p>
      )}
      {!stages.length && !matchesOnly ? (
        <div className="tw-panel tw-empty">
          <GitBranch />
          <h3>
            {copy(
              "Choose how this competition will work",
              "კარგი ტურნირი მარტივი ბადით იწყება",
            )}
          </h3>
          <p>
            {copy(
              "Use a knockout cup for a winner after every round, or a league where every team plays each other.",
              "აირჩიეთ სათასო ფორმატი ან ლიგა, სადაც ყველა გუნდი ერთმანეთს შეხვდება.",
            )}
          </p>
          {editable && (
            <button className="tw-primary" onClick={openCreate}>
              {copy("Create the competition", "შექმენით შეჯიბრება")}
            </button>
          )}
        </div>
      ) : (
        <>
          {!matchesOnly && (
            <div className="tw-toolbar">
              <label
                className="tw-field"
                style={{ margin: 0, maxWidth: 330, width: "100%" }}
              >
                <span className="sr-only">
                  {copy("Tournament stage", "ტურნირის ეტაპი")}
                </span>
                <select
                  value={stage?.id ?? ""}
                  onChange={(e) => setStageId(Number(e.target.value))}
                  disabled={busy}
                >
                  {stages.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {editable && (
                <div className="tw-actions">
                  <button
                    className="tw-button"
                    disabled={busy}
                    onClick={openCreate}
                  >
                    <Plus size={15} />
                    {copy("Add competition stage", "შეჯიბრების ეტაპის დამატება")}
                  </button>
                </div>
              )}
              {canArrange && (
                <div className="tw-actions">
                  <button
                    className="tw-button"
                    disabled={
                      busy ||
                      count < 2 ||
                      (stage?.stageType !== "KNOCKOUT" && fixtures.length > 0)
                    }
                    onClick={() => void arrange()}
                  >
                    <List size={14} />
                    {stage?.stageType === "KNOCKOUT"
                      ? copy(
                          "Place teams for me",
                          "გუნდების ავტომატური განაწილება",
                        )
                      : copy("Generate matches", "მატჩების შექმნა")}
                  </button>
                  {stage?.stageType === "KNOCKOUT" && (
                    <button
                      className="tw-button"
                      disabled={busy || count < 2}
                      onClick={() => void arrange(true)}
                    >
                      <Shuffle size={14} />
                      {copy("Shuffle bracket", "ბადის წილისყრა")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {!matchesOnly && stage?.stageType === "KNOCKOUT" ? (
            <div className="tw-panel">
              <TournamentBracketBoard
                key={`${stage.id}:${boardVersion}`}
                tournament={tournament}
                stageId={stage.id}
                canManage={canManage}
                canScore={canScore}
                onSaveScore={async (fixture, result) => {
                  onUpdate(
                    await updateFixtureScores(tournament.id, fixture.id, {
                      homeScore: result.homeScore!,
                      awayScore: result.awayScore!,
                    }),
                  );
                }}
                onAdvance={async (fixture, result) => {
                  onUpdate(
                    await completeFixture(tournament.id, fixture.id, {
                      ...result,
                      winnerEntryId: result.winnerEntryId ?? null,
                    }),
                  );
                }}
                busy={busy}
                onRemove={async (entry, fixture, slot) => {
                  onUpdate(
                    await unplaceTournamentEntry(
                      tournament.id,
                      fixture,
                      entry,
                      slot,
                    ),
                  );
                }}
                onPlace={async (entry, fixture, slot) => {
                  onUpdate(
                    await placeTournamentEntry(
                      tournament.id,
                      fixture,
                      entry,
                      slot,
                    ),
                  );
                }}
                onMatch={onMatch}
              />
            </div>
          ) : (
            <>
              {matchesOnly && (
                <div className="tw-filter" style={{ marginBottom: 16 }}>
                  {[
                    ["all", copy("All matches", "ყველა მატჩი")],
                    ["unscheduled", copy("Needs a time", "დრო დასანიშნია")],
                    ["SCHEDULED", copy("Upcoming", "მომავალი")],
                    ["COMPLETED", copy("Results", "შედეგები")],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className="tw-button"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {!matchesOnly && stage && (
                <div className="tw-panel" style={{ marginBottom: 18 }}>
                  <StandingsTable
                    tournamentId={tournament.id}
                    stageId={stage.id}
                    refreshKey={JSON.stringify(
                      [boardVersion, ...tournament.fixtures.map((f) => [
                        f.id,
                        f.status,
                        f.homeEntryId,
                        f.awayEntryId,
                        f.homeScore,
                        f.awayScore,
                        f.winnerEntryId,
                      ])],
                    )}
                    entryStatuses={
                      new Map(tournament.entries.map((e) => [e.id, e.status]))
                    }
                    advanceCount={stage.advanceCount}
                  />
                </div>
              )}
              <div className="tw-panel tw-match-list">
                {visible.length === 0 ? (
                  <div className="tw-empty">
                    <Trophy />
                    <h3>
                      {copy("No matches here yet", "მატჩები ჯერ არ არის")}
                    </h3>
                    <p>
                      {copy(
                        "Create a competition stage and generate matches to build your schedule.",
                        "შექმენით ბადე და მატჩები განრიგის შესადგენად.",
                      )}
                    </p>
                  </div>
                ) : (
                  visible.map((f) => (
                    <div className="tw-match-row" key={f.id}>
                      <div>
                        <p>
                          {f.stageName} · {copy("Round", "რაუნდი")}{" "}
                          {f.roundNumber} ·{" "}
                          {f.scheduledAt
                            ? new Date(f.scheduledAt).toLocaleString(
                                i18n.language.startsWith("ka")
                                  ? "ka-GE"
                                  : "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : copy("Time to be set", "დრო დასანიშნია")}
                        </p>
                        <strong>
                          {label(f.homeEntryId, f.homeLabel)}{" "}
                          <span
                            style={{
                              color: "var(--tw-muted)",
                              padding: "0 8px",
                            }}
                          >
                            {f.homeScore != null && f.awayScore != null
                              ? `${f.homeScore} – ${f.awayScore}`
                              : "vs"}
                          </span>{" "}
                          {label(f.awayEntryId, f.awayLabel)}
                        </strong>
                      </div>
                      <span className="tw-badge">
                        {f.status === "COMPLETED"
                          ? copy("Full time", "დასრულებულია")
                          : f.status === "CANCELLED"
                            ? copy("Cancelled", "გაუქმებულია")
                            : copy("Upcoming", "მომავალი")}
                      </span>
                      <button className="tw-button" onClick={() => onMatch(f)}>
                        {f.status === "COMPLETED"
                          ? copy("View result", "შედეგის ნახვა")
                          : f.scheduledAt
                            ? copy("Enter result", "შედეგის ჩაწერა")
                            : copy("Set time / result", "დრო / შედეგი")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
      {creating && (
        <div className="tw-modal-backdrop">
          <div
            className="tw-dialog"
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tw-create-draw"
          >
            <div className="tw-section-title">
              <h2 id="tw-create-draw">
                {copy("Create a competition stage", "შეჯიბრების ეტაპის შექმნა")}
              </h2>
              <button
                className="tw-icon"
                disabled={busy}
                aria-label={copy("Close", "დახურვა")}
                onClick={() => setCreating(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p>
              {copy(
                "Choose how teams compete. We will build the matches for you.",
                "აირჩიეთ თამაშის ფორმატი. მატჩები ავტომატურად შეიქმნება.",
              )}
            </p>
            {error && (
              <p role="alert" className="tw-error">
                {error}
              </p>
            )}
            <div className="tw-format-options">
              <button
                aria-pressed={type === "KNOCKOUT"}
                onClick={() => setType("KNOCKOUT")}
                disabled={busy}
              >
                <GitBranch />
                <strong>{copy("Knockout cup", "სათასო ტურნირი")}</strong>
                <p>
                  {copy(
                    "Win to go through. A clear path to the final.",
                    "გამარჯვებული გადის შემდეგ ეტაპზე.",
                  )}
                </p>
              </button>
              <button
                aria-pressed={type !== "KNOCKOUT"}
                onClick={() => setType("ROUND_ROBIN")}
                disabled={busy}
              >
                <List />
                <strong>{copy("League / group", "ლიგა / ჯგუფი")}</strong>
                <p>
                  {copy(
                    "Everyone plays everyone. Ranked by points.",
                    "ყველა ყველას ეთამაშება. რეიტინგი ქულებით.",
                  )}
                </p>
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <label>
                {copy("Stage name (optional)", "ეტაპის სახელი (არასავალდებულო)")}
                <input
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  placeholder={
                    type === "KNOCKOUT"
                      ? copy("Knockout bracket", "სათასო ბადე")
                      : copy("Group A", "ჯგუფი A")
                  }
                />
              </label>
              {type === "KNOCKOUT" && (
                <label>
                  {copy("Number of places", "ადგილების რაოდენობა")}
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    disabled={busy}
                  >
                    {[2, 4, 8, 16, 32, 64].map((n) => (
                      <option key={n} value={n}>
                        {n} {copy("teams", "გუნდი")}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "var(--tw-muted)" }}>
                    {copy(
                      `${count} teams ready. At least ${Number(size) / 2} teams are needed to start this draw; spare opponents become byes.`,
                      `${count} გუნდი მზადაა. ამ ბადის დასაწყებად საჭიროა სულ მცირე ${Number(size) / 2} გუნდი; უმეტოქო გუნდები ავტომატურად გადიან.`,
                    )}
                  </small>
                </label>
              )}
              <label style={{ flexDirection: "row", alignItems: "center" }}>
                <input
                  style={{ width: 18, minHeight: 18 }}
                  type="checkbox"
                  checked={autoPlace}
                  onChange={(e) => setAutoPlace(e.target.checked)}
                  disabled={busy || count < 2}
                />
                {copy(
                  "Place confirmed teams automatically",
                  "გუნდების ავტომატური განაწილება",
                )}
              </label>
              <div className="tw-actions">
                <button
                  type="button"
                  className="tw-button"
                  disabled={busy}
                  onClick={() => setCreating(false)}
                >
                  {copy("Cancel", "გაუქმება")}
                </button>
                <button
                  className="tw-primary"
                  disabled={
                    busy ||
                    (autoPlace && type === "KNOCKOUT" && count > Number(size))
                  }
                  type="submit"
                >
                  {busy
                    ? copy("Preparing…", "მზადდება…")
                    : copy("Create competition stage", "შეჯიბრების ეტაპის შექმნა")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
