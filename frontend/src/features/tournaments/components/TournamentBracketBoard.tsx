import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Minus, Plus, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "../../../components/workspace/useDialogFocus";
import { extractApiErrorMessage } from "../../../utils/apiError";
import type { TournamentDetail, TournamentFixtureDto } from "../domain";
import { participantName, isBracketParticipant } from "../participantLabels";
import { TournamentBracketMatch } from "./TournamentBracketMatch";
import {
  hasCompletedFeeders,
  isWinnerDestination,
} from "../bracketProgression";
import type { BracketResult, WinnerDrag } from "./TournamentBracketMatch";
import "./tournament-workspace.css";
import "./tournament-inline-bracket.css";

type Slot = "HOME" | "AWAY";
interface Props {
  tournament: TournamentDetail;
  stageId?: number;
  canManage?: boolean;
  canScore?: boolean;
  onSaveScore?: (
    fixture: TournamentFixtureDto,
    result: BracketResult,
  ) => Promise<void>;
  onAdvance?: (
    fixture: TournamentFixtureDto,
    result: BracketResult,
  ) => Promise<void>;
  busy?: boolean;
  onPlace?: (entryId: number, fixtureId: number, slot: Slot) => Promise<void>;
  onRemove?: (entryId: number, fixtureId: number, slot: Slot) => Promise<void>;
  onMatch?: (fixture: TournamentFixtureDto) => void;
}

/** Shared public/organizer bracket. This component never fetches private data. */
export function TournamentBracketBoard({
  tournament,
  stageId,
  canManage = false,
  canScore = false,
  onSaveScore,
  onAdvance,
  busy = false,
  onPlace,
  onRemove,
  onMatch,
}: Props) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) =>
    i18n.language.startsWith("ka") ? ka : en;
  const stage =
    tournament.stages.find((s) => s.id === stageId) ??
    tournament.stages.find((s) => s.stageType === "KNOCKOUT");
  const fixtures = useMemo(
    () =>
      tournament.fixtures
        .filter((f) => f.stageId === stage?.id)
        .sort(
          (a, b) =>
            (a.roundNumber ?? 1) - (b.roundNumber ?? 1) ||
            (a.fixtureOrder ?? a.id) - (b.fixtureOrder ?? b.id),
        ),
    [tournament.fixtures, stage?.id],
  );
  const rounds = [...new Set(fixtures.map((f) => f.roundNumber ?? 1))];
  // Older tournaments used a named stage for each round without round metadata.
  const legacyRoundName =
    fixtures.length > 0 && fixtures.every((f) => f.roundNumber == null)
      ? stage?.name
      : null;
  const entries = new Map(tournament.entries.map((e) => [e.id, e]));
  const available = tournament.entries.filter(isBracketParticipant);
  const assigned = new Set(
    fixtures
      .flatMap((f) => [f.homeEntryId, f.awayEntryId])
      .filter((id) => id != null),
  );
  const pool = available.filter((e) => !assigned.has(e.id));
  const editable =
    canManage &&
    !!onPlace &&
    tournament.status === "PLANNING" &&
    fixtures.every((f) => f.status === "SCHEDULED");
  const [selected, setSelected] = useState<number | null>(null);
  const [target, setTarget] = useState<{
    fixture: TournamentFixtureDto;
    slot: Slot;
  } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [winnerDrag, setWinnerDrag] = useState<WinnerDrag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [compact, setCompact] = useState(() => window.innerWidth < 480);
  useEffect(() => {
    const resize = () => setCompact(window.innerWidth < 480);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pending = busy || placing;
  useDialogFocus(!!target, dialogRef, () => {
    if (!pending) setTarget(null);
  });
  const place = async (
    entryId: number,
    fixture: TournamentFixtureDto,
    slot: Slot,
  ) => {
    if (!editable || pending || !onPlace) return;
    setPlacing(true);
    setError("");
    setNotice("");
    try {
      await onPlace(entryId, fixture.id, slot);
      setSelected(null);
      setTarget(null);
      setNotice(copy("Bracket updated.", "ბადე განახლდა."));
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not move this team. Please try again.",
            "გუნდის გადაადგილება ვერ მოხერხდა. სცადეთ ხელახლა.",
          ),
        ),
      );
    } finally {
      setPlacing(false);
      setDragging(null);
      setOver(null);
    }
  };
  const returnToPool = async () => {
    if (!target || !onRemove || !editable || pending) return;
    const entryId =
      target.slot === "HOME"
        ? target.fixture.homeEntryId
        : target.fixture.awayEntryId;
    if (entryId == null) return;
    setPlacing(true);
    setError("");
    setNotice("");
    try {
      await onRemove(entryId, target.fixture.id, target.slot);
      setSelected(null);
      setTarget(null);
      setNotice(
        copy(
          "Team returned to the participant pool.",
          "გუნდი დაბრუნდა გასანაწილებელ მონაწილეებში.",
        ),
      );
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not clear this spot.",
            "ადგილის გათავისუფლება ვერ მოხერხდა.",
          ),
        ),
      );
    } finally {
      setPlacing(false);
    }
  };
  if (!stage || fixtures.length === 0)
    return (
      <div className="tw-empty">
        <Trophy />
        <h3>
          {copy("The draw is still to come", "წილისყრა ჯერ არ ჩატარებულა")}
        </h3>
        <p>
          {copy(
            "The bracket will appear here when the organizer creates the draw.",
            "ბადე გამოჩნდება, როცა ორგანიზატორი წილისყრას მოამზადებს.",
          )}
        </p>
      </div>
    );
  const firstCount = fixtures.filter(
    (f) => (f.roundNumber ?? 1) === rounds[0],
  ).length;
  const scoring =
    canScore && tournament.status === "ACTIVE" && !!onSaveScore && !!onAdvance;
  const columnWidth = scoring ? (compact ? 280 : 312) : 268;
  const spacing = scoring ? 280 : 168;
  const center = scoring ? 88 : 61;
  const height = Math.max(spacing, firstCount * spacing);
  const width = rounds.length * (columnWidth + 24) - 24;
  const slotLabel = (fixture: TournamentFixtureDto, slot: Slot) => {
    const id = slot === "HOME" ? fixture.homeEntryId : fixture.awayEntryId;
    if (id != null)
      return participantName(entries.get(id)) !== "—"
        ? participantName(entries.get(id))
        : (slot === "HOME" ? fixture.homeLabel : fixture.awayLabel) ||
            copy("Participant", "მონაწილე");
    const round = fixture.roundNumber ?? 1;
    if (round > rounds[0])
      return copy(
        `Winner of R${round - 1} · Match ${(fixture.fixtureOrder ?? 1) * 2 - (slot === "HOME" ? 1 : 0)}`,
        `გამარჯვებული R${round - 1} · მატჩი ${(fixture.fixtureOrder ?? 1) * 2 - (slot === "HOME" ? 1 : 0)}`,
      );
    return fixture.status === "COMPLETED"
      ? copy("Bye", "უმეტოქოდ")
      : copy("Open spot", "თავისუფალი ადგილი");
  };
  return (
    <div className="tw-bracket">
      <div className="tw-board-toolbar">
        <div>
          <strong>{copy("Tournament bracket", "ტურნირის ბადე")}</strong>
          <p>
            {editable
              ? copy(
                  "Drag teams into spots, or select a team and click a spot. Occupied spots swap.",
                  "გადაათრიეთ გუნდი ან აირჩიეთ გუნდი და დააჭირეთ ადგილს. დაკავებული ადგილები იცვლება.",
                )
              : scoring
                ? copy(
                    "Type a score or add goals with +. Use the arrow beside the winner, or drag them into their next-round spot.",
                    "ჩაწერეთ ანგარიში ან დაამატეთ გოლი + ღილაკით. გამარჯვებული გადაიყვანეთ ისრით ან გადაათრიეთ შემდეგ ეტაპზე.",
                  )
                : copy(
                    "Follow every round on the road to the final.",
                    "თვალი ადევნეთ ყველა ეტაპს ფინალამდე.",
                  )}
          </p>
        </div>
        <div className="tw-actions">
          <button
            className="tw-icon"
            aria-label={copy("Zoom out", "შემცირება")}
            disabled={zoom <= 0.5}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            <Minus size={16} />
          </button>
          <button
            className="tw-button"
            onClick={() => setZoom(1)}
            aria-label={copy("Reset bracket zoom", "ბადის მასშტაბის აღდგენა")}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="tw-icon"
            aria-label={copy("Zoom in", "გადიდება")}
            disabled={zoom >= 1.5}
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.25))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      {notice && (
        <p className="tw-notice" role="status">
          {notice}
        </p>
      )}
      {error && !target && (
        <p className="tw-error" role="alert">
          {error}
        </p>
      )}
      <div className={editable ? "tw-board-layout" : ""}>
        {editable && (
          <aside className="tw-team-pool">
            <div className="tw-section-title">
              <strong>{copy("Ready to place", "გასანაწილებელი")}</strong>
              <span>{pool.length}</span>
            </div>
            <p>
              {copy(
                "Drag a team, or use Select.",
                "გადაათრიეთ გუნდი ან გამოიყენეთ არჩევა.",
              )}
            </p>
            {pool.map((e) => (
              <button
                key={e.id}
                className={`tw-pool-team ${selected === e.id ? "is-selected" : ""}`}
                disabled={pending}
                draggable={!pending}
                onDragStart={(event) => {
                  setDragging(e.id);
                  event.dataTransfer.setData("text/plain", String(e.id));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onClick={() => setSelected(selected === e.id ? null : e.id)}
                aria-pressed={selected === e.id}
              >
                <GripVertical size={16} />
                <span>{participantName(e)}</span>{" "}
                <small>
                  {selected === e.id
                    ? copy("Selected", "არჩეულია")
                    : copy("Select", "არჩევა")}
                </small>
              </button>
            ))}
            {pool.length === 0 && (
              <p className="tw-pool-empty">
                {copy(
                  "All teams are placed. Select a team in the bracket to move it.",
                  "ყველა გუნდი განაწილებულია. გადასაადგილებლად აირჩიეთ გუნდი ბადეში.",
                )}
              </p>
            )}
            {selected != null && (
              <button className="tw-button" onClick={() => setSelected(null)}>
                {copy("Cancel selection", "არჩევის გაუქმება")}
              </button>
            )}
          </aside>
        )}
        <div
          className="tw-board-scroll"
          tabIndex={0}
          role="region"
          aria-label={copy(
            "Bracket rounds, scroll horizontally to see the final",
            "ბადის რაუნდები, ფინალისთვის გადაახვიეთ ჰორიზონტალურად",
          )}
        >
          <div style={{ width: width * zoom, height: (height + 46) * zoom }}>
            <div
              className="tw-rounds"
              style={{
                width,
                height: height + 46,
                transform: `scale(${zoom})`,
              }}
            >
              {rounds.map((round, index) => (
                <section
                  className="tw-round"
                  key={round}
                  style={{ width: columnWidth }}
                >
                  <h3>
                    {legacyRoundName
                      ? legacyRoundName
                      : rounds.length - index === 1
                        ? copy("Final", "ფინალი")
                        : rounds.length - index === 2
                          ? copy("Semi-finals", "ნახევარფინალი")
                          : rounds.length - index === 3
                            ? copy("Quarter-finals", "მეოთხედფინალი")
                            : copy(`Round ${round}`, `რაუნდი ${round}`)}
                  </h3>
                  <div className="tw-round-matches" style={{ height }}>
                    {fixtures
                      .filter((f) => (f.roundNumber ?? 1) === round)
                      .map((fixture, fixtureIndex, list) => (
                        <article
                          key={fixture.id}
                          data-fixture-id={fixture.id}
                          className={`tw-match-card ${fixture.status === "COMPLETED" ? "is-complete" : ""}`}
                          style={{
                            width: columnWidth,
                            top:
                              ((fixtureIndex + 0.5) * height) / list.length -
                              center,
                          }}
                        >
                          <TournamentBracketMatch
                            key={`${fixture.id}:${fixture.homeEntryId}:${fixture.awayEntryId}`}
                            fixture={fixture}
                            label={(slot) => slotLabel(fixture, slot)}
                            editable={
                              editable &&
                              round === rounds[0] &&
                              fixture.linkedMatchId == null
                            }
                            scoreable={
                              scoring &&
                              fixture.status === "SCHEDULED" &&
                              fixture.linkedMatchId == null &&
                              fixture.homeEntryId != null &&
                              fixture.awayEntryId != null &&
                              hasCompletedFeeders(fixture, fixtures)
                            }
                            final={index === rounds.length - 1}
                            pending={pending}
                            selected={selected}
                            over={over}
                            onChoose={(slot, id) => {
                              setError("");
                              if (selected != null && selected !== id)
                                void place(selected, fixture, slot);
                              else setTarget({ fixture, slot });
                            }}
                            onPlanningDrag={(id) => {
                              setDragging(id);
                              setWinnerDrag(null);
                            }}
                            onWinnerDrag={(value) => {
                              setWinnerDrag(value);
                              setDragging(null);
                            }}
                            onDragEnd={() => {
                              setDragging(null);
                              setWinnerDrag(null);
                              setOver(null);
                            }}
                            canDrop={(slot) => {
                              if (
                                editable &&
                                round === rounds[0] &&
                                fixture.linkedMatchId == null &&
                                dragging != null
                              )
                                return true;
                              const source = fixtures.find(
                                (f) => f.id === winnerDrag?.fixtureId,
                              );
                              return (
                                scoring &&
                                source != null &&
                                isWinnerDestination(source, fixture, slot)
                              );
                            }}
                            onOver={(slot) =>
                              setOver(slot ? `${fixture.id}-${slot}` : null)
                            }
                            onDrop={(slot) => {
                              if (editable && dragging != null)
                                void place(dragging, fixture, slot);
                              else if (winnerDrag) void winnerDrag.advance();
                            }}
                            onSave={onSaveScore}
                            onAdvance={onAdvance}
                            onPending={setPlacing}
                            onMatch={onMatch}
                          />
                          {index < rounds.length - 1 && (
                            <span
                              className="tw-connector"
                              aria-hidden="true"
                              style={{
                                height: height / list.length / 2 + 1,
                                top: center,
                                transform:
                                  fixtureIndex % 2 ? "scaleY(-1)" : undefined,
                              }}
                            />
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
      {target && (
        <div className="tw-modal-backdrop">
          <div
            className="tw-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tw-place-title"
            ref={dialogRef}
          >
            <div className="tw-section-title">
              <h2 id="tw-place-title">
                {copy("Choose a team", "აირჩიეთ გუნდი")}
              </h2>
              <button
                className="tw-icon"
                aria-label={copy("Close", "დახურვა")}
                disabled={pending}
                onClick={() => setTarget(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p>
              {copy(
                "Choose any ready team. If it is already placed, the two spots swap.",
                "აირჩიეთ გუნდი. უკვე განაწილებული გუნდის არჩევისას ადგილები შეიცვლება.",
              )}
            </p>
            {error && (
              <p className="tw-error" role="alert">
                {error}
              </p>
            )}
            {(target.slot === "HOME"
              ? target.fixture.homeEntryId
              : target.fixture.awayEntryId) != null && (
              <button
                className="tw-button"
                disabled={pending}
                onClick={() => {
                  setSelected(
                    target.slot === "HOME"
                      ? target.fixture.homeEntryId
                      : target.fixture.awayEntryId,
                  );
                  setTarget(null);
                }}
              >
                {copy(
                  "Select this team to move",
                  "აირჩიეთ ეს გუნდი გადასაადგილებლად",
                )}
              </button>
            )}
            <div className="tw-choice-list">
              {onRemove &&
                (target.slot === "HOME"
                  ? target.fixture.homeEntryId
                  : target.fixture.awayEntryId) != null && (
                  <button
                    className="tw-button"
                    disabled={pending}
                    onClick={() => void returnToPool()}
                  >
                    {copy(
                      "Return team to pool",
                      "გუნდის დაბრუნება მონაწილეებში",
                    )}
                  </button>
                )}
              {available.map((entry) => (
                <button
                  key={entry.id}
                  className="tw-pool-team"
                  disabled={pending}
                  onClick={() =>
                    void place(entry.id, target.fixture, target.slot)
                  }
                >
                  <span>{participantName(entry)}</span>{" "}
                  <small>
                    {assigned.has(entry.id)
                      ? copy("Move / swap", "გადაადგილება / გაცვლა")
                      : copy("Place team", "გუნდის განაწილება")}
                  </small>
                </button>
              ))}
            </div>
            {!available.length && (
              <p>
                {copy(
                  "Add or approve a team first.",
                  "ჯერ დაამატეთ ან დაამტკიცეთ გუნდი.",
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
