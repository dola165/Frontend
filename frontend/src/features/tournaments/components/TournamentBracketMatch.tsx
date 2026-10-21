import { useState } from "react";
import { ArrowRight, GripVertical, Plus, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TournamentFixtureDto } from "../domain";
import { extractApiErrorMessage } from "../../../utils/apiError";

export type BracketSlot = "HOME" | "AWAY";
export interface BracketResult {
  homeScore: number | null;
  awayScore: number | null;
  winnerEntryId?: number;
}
export interface WinnerDrag {
  fixtureId: number;
  entryId: number;
  advance: () => Promise<void>;
}

interface Props {
  fixture: TournamentFixtureDto;
  label: (slot: BracketSlot) => string;
  editable: boolean;
  scoreable: boolean;
  final: boolean;
  pending: boolean;
  selected: number | null;
  over: string | null;
  onChoose: (slot: BracketSlot, id: number | null) => void;
  onPlanningDrag: (id: number) => void;
  onWinnerDrag: (drag: WinnerDrag) => void;
  onDragEnd: () => void;
  canDrop: (slot: BracketSlot) => boolean;
  onOver: (slot: BracketSlot | null) => void;
  onDrop: (slot: BracketSlot) => void;
  onSave?: (
    fixture: TournamentFixtureDto,
    result: BracketResult,
  ) => Promise<void>;
  onAdvance?: (
    fixture: TournamentFixtureDto,
    result: BracketResult,
  ) => Promise<void>;
  onPending: (pending: boolean) => void;
  onMatch?: (fixture: TournamentFixtureDto) => void;
}

export function TournamentBracketMatch(props: Props) {
  const { fixture, label, editable, scoreable, pending } = props;
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) =>
    i18n.language.startsWith("ka") ? ka : en;
  const [home, setHome] = useState(String(fixture.homeScore ?? ""));
  const [away, setAway] = useState(String(fixture.awayScore ?? ""));
  const serverScore = `${fixture.homeScore}:${fixture.awayScore}`;
  const [lastServerScore, setLastServerScore] = useState(serverScore);
  // Keep the same card/input nodes after saving so keyboard focus and feedback survive.
  // An unrelated tournament refresh keeps drafts; changed server scores replace them.
  if (lastServerScore !== serverScore) {
    setLastServerScore(serverScore);
    setHome(String(fixture.homeScore ?? ""));
    setAway(String(fixture.awayScore ?? ""));
  }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = (value: string) =>
    /^\d{1,3}$/.test(value) && Number(value) <= 999;
  const scoresValid = valid(home) && valid(away);
  const noScores = home === "" && away === "";
  const dirty =
    home !== String(fixture.homeScore ?? "") ||
    away !== String(fixture.awayScore ?? "");
  const result = {
    homeScore: home === "" ? null : Number(home),
    awayScore: away === "" ? null : Number(away),
  };
  const canAdvance = (slot: BracketSlot) =>
    scoreable &&
    !!props.onAdvance &&
    (noScores ||
      (scoresValid &&
        (slot === "HOME"
          ? Number(home) >= Number(away)
          : Number(away) >= Number(home))));
  const submit = async (winnerEntryId?: number) => {
    if (pending || saving || !scoreable) return;
    const callback = winnerEntryId == null ? props.onSave : props.onAdvance;
    if (
      !callback ||
      (winnerEntryId == null ? !scoresValid : !(noScores || scoresValid))
    )
      return;
    setSaving(true);
    props.onPending(true);
    setError("");
    setNotice("");
    try {
      await callback(fixture, {
        ...result,
        ...(winnerEntryId == null ? {} : { winnerEntryId }),
      });
      setNotice(
        winnerEntryId == null
          ? copy("Score saved.", "ანგარიში შენახულია.")
          : copy("Winner confirmed.", "გამარჯვებული დადასტურებულია."),
      );
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not save. Your score is kept here; try again.",
            "შენახვა ვერ მოხერხდა. ანგარიში შენარჩუნებულია; სცადეთ ხელახლა.",
          ),
        ),
      );
    } finally {
      setSaving(false);
      props.onPending(false);
      props.onDragEnd();
    }
  };
  return (
    <>
      <div className="tw-match-meta">
        <span>
          {copy("Match", "მატჩი")} {fixture.fixtureOrder}
        </span>
        <span>
          {fixture.status === "COMPLETED"
            ? copy("Full time", "დასრულებულია")
            : fixture.status === "CANCELLED"
              ? copy("Cancelled", "გაუქმებულია")
              : fixture.scheduledAt
                ? new Date(fixture.scheduledAt).toLocaleString(
                    i18n.language.startsWith("ka") ? "ka-GE" : "en-GB",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )
                : copy("Time to be set", "დრო დასანიშნია")}
        </span>
      </div>
      {(["HOME", "AWAY"] as const).map((slot) => {
        const id = slot === "HOME" ? fixture.homeEntryId : fixture.awayEntryId;
        const score = slot === "HOME" ? home : away;
        const setScore = slot === "HOME" ? setHome : setAway;
        const winner = id != null && id === fixture.winnerEntryId;
        const canWin = id != null && canAdvance(slot);
        const drag =
          !pending && id != null && (editable || (canWin && !props.final));
        return (
          <div
            key={slot}
            className={`tw-slot-row ${scoreable ? "has-score-controls" : ""}`}
          >
            <button
              type="button"
              className={`tw-bracket-slot ${id == null ? "is-empty" : ""} ${winner ? "is-winner" : ""} ${props.selected === id && id != null ? "is-selected" : ""} ${props.over === `${fixture.id}-${slot}` ? "is-over" : ""}`}
              disabled={
                pending || (!editable && !scoreable && !props.canDrop(slot))
              }
              draggable={drag}
              aria-label={
                editable
                  ? `${label(slot)} · ${copy("choose or move team", "გუნდის არჩევა ან გადაადგილება")} · R${fixture.roundNumber} ${copy("Match", "მატჩი")} ${fixture.fixtureOrder} ${slot === "HOME" ? copy("top spot", "ზედა ადგილი") : copy("bottom spot", "ქვედა ადგილი")}`
                  : `${label(slot)} · R${fixture.roundNumber} ${copy("Match", "მატჩი")} ${fixture.fixtureOrder} ${slot}`
              }
              onDragStart={(event) => {
                if (!drag || id == null) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData("text/plain", String(id));
                event.dataTransfer.effectAllowed = "move";
                if (editable) props.onPlanningDrag(id);
                else
                  props.onWinnerDrag({
                    fixtureId: fixture.id,
                    entryId: id,
                    advance: () => submit(id),
                  });
              }}
              onDragEnd={props.onDragEnd}
              onDragOver={(event) => {
                if (!pending && props.canDrop(slot)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  props.onOver(slot);
                }
              }}
              onDragLeave={() => props.onOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                if (!pending && props.canDrop(slot)) props.onDrop(slot);
              }}
              onClick={() => {
                if (editable) props.onChoose(slot, id);
              }}
            >
              <span>
                {drag && <GripVertical size={14} />}
                <span>{label(slot)}</span>
              </span>
              {!scoreable && (
                <strong>
                  {winner && <Trophy size={13} />} {score || "–"}
                </strong>
              )}
            </button>
            {scoreable && (
              <>
                <input
                  className="tw-inline-score"
                  type="number"
                  min={0}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  aria-label={copy(
                    `Score for ${label(slot)}`,
                    `${label(slot)} — ანგარიში`,
                  )}
                  value={score}
                  disabled={pending}
                  placeholder="–"
                  onChange={(event) => {
                    setScore(event.target.value);
                    setNotice("");
                    if (event.target.value !== "") {
                      if (slot === "HOME" && away === "") setAway("0");
                      if (slot === "AWAY" && home === "") setHome("0");
                    }
                  }}
                />
                <button
                  className="tw-goal-add"
                  type="button"
                  disabled={
                    pending ||
                    (score !== "" && !valid(score)) ||
                    Number(score) >= 999
                  }
                  aria-label={copy(
                    `Add goal for ${label(slot)}`,
                    `${label(slot)} — გოლის დამატება`,
                  )}
                  onClick={() => {
                    setScore(String(Number(score || 0) + 1));
                    if (slot === "HOME" && away === "") setAway("0");
                    if (slot === "AWAY" && home === "") setHome("0");
                    setNotice("");
                  }}
                >
                  <Plus size={14} />
                </button>
                <button
                  className="tw-advance"
                  type="button"
                  disabled={pending || !canWin}
                  aria-label={
                    props.final
                      ? copy(
                          `Declare ${label(slot)} winner`,
                          `გამარჯვებულად გამოცხადება: ${label(slot)}`,
                        )
                      : copy(
                          `Advance ${label(slot)}`,
                          `შემდეგ ეტაპზე გადაყვანა: ${label(slot)}`,
                        )
                  }
                  title={
                    props.final
                      ? copy("Declare winner", "გამარჯვებულის გამოცხადება")
                      : copy("Advance to next round", "შემდეგ ეტაპზე გადაყვანა")
                  }
                  onClick={() => {
                    if (id != null && canWin) void submit(id);
                  }}
                >
                  {props.final ? (
                    <Trophy size={14} />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                </button>
              </>
            )}
          </div>
        );
      })}
      {scoreable && (
        <div className="tw-inline-result-footer">
          <span>
            {saving
              ? copy("Saving…", "ინახება…")
              : !noScores && !scoresValid
                ? copy(
                    "Enter both scores, 0–999.",
                    "შეიყვანეთ ორივე ანგარიში: 0–999.",
                  )
                : scoresValid && home === away
                  ? copy(
                      "Tied? Advance the penalty winner.",
                      "ფრეა? გადაიყვანეთ პენალტების გამარჯვებული.",
                    )
                  : dirty
                    ? copy("Unsaved score", "შეუნახავი ანგარიში")
                    : copy(
                        "Use → to advance the winner.",
                        "→ გამარჯვებულის გადასაყვანად.",
                      )}
          </span>
          <button
            className="tw-button"
            type="button"
            disabled={pending || !scoresValid || !dirty}
            onClick={() => void submit()}
          >
            {copy("Save score", "ანგარიშის შენახვა")}
          </button>
        </div>
      )}
      {error && (
        <p className="tw-inline-feedback tw-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="tw-inline-feedback" role="status">
          {notice}
        </p>
      )}
      {props.onMatch && (
        <button
          className="tw-match-open"
          disabled={pending}
          onClick={() => props.onMatch?.(fixture)}
        >
          {fixture.status === "COMPLETED"
            ? copy("Result details", "შედეგის დეტალები")
            : copy(
                "Kickoff & match details",
                "დაწყების დრო და მატჩის დეტალები",
              )}
        </button>
      )}
    </>
  );
}
