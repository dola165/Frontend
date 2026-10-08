import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "../../../components/workspace/useDialogFocus";
import { extractApiErrorMessage } from "../../../utils/apiError";
import {
  cancelFixture,
  completeFixture,
  reopenFixture,
  scheduleTournamentFixture,
  updateFixtureScores,
} from "../api";
import type { TournamentDetail, TournamentFixtureDto } from "../domain";
import { participantName } from "../participantLabels";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { TournamentFixtureReferees } from "./TournamentFixtureReferees";
import { VenueReservationSummary } from '../../eventVenues/VenueReservationSummary';
import { ExtensionDemoLabel, ExtensionSurface } from '../../capabilities/ExtensionBoundary';
import { isExtensionCapabilityAvailable } from '../../capabilities/extensions';

interface Props {
  tournament: TournamentDetail;
  fixture: TournamentFixtureDto;
  canManage: boolean;
  canScore: boolean;
  onUpdate: (value: TournamentDetail) => void;
  onClose: () => void;
}
export function TournamentMatchDialog({
  tournament,
  fixture,
  canManage,
  canScore,
  onUpdate,
  onClose,
}: Props) {
  const { i18n } = useTranslation();
  const copy = (en: string, ka: string) =>
    i18n.language.startsWith("ka") ? ka : en;
  const [home, setHome] = useState(
    fixture.homeScore == null ? "" : String(fixture.homeScore),
  );
  const [away, setAway] = useState(
    fixture.awayScore == null ? "" : String(fixture.awayScore),
  );
  const [kickoff, setKickoff] = useState(
    fixture.scheduledAt?.slice(0, 16) ?? "",
  );
  const [tieWinner, setTieWinner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "reopen" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref, () => {
    if (!busy) onClose();
  });
  const homeLabel = participantName(
    tournament.entries.find((e) => e.id === fixture.homeEntryId),
  );
  const awayLabel = participantName(
    tournament.entries.find((e) => e.id === fixture.awayEntryId),
  );
  const knockout =
    tournament.stages.find((s) => s.id === fixture.stageId)?.stageType ===
    "KNOCKOUT";
  const scoringOpen = tournament.status === "ACTIVE";
  const validScores =
    home !== "" &&
    away !== "" &&
    [Number(home), Number(away)].every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 999,
    );
  const tied = validScores && Number(home) === Number(away);
  const winner = !validScores
    ? null
    : Number(home) > Number(away)
      ? fixture.homeEntryId
      : Number(away) > Number(home)
        ? fixture.awayEntryId
        : tieWinner
          ? Number(tieWinner)
          : null;
  const act = async (
    action: () => Promise<TournamentDetail>,
    close = false,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      onUpdate(await action());
      setNotice(copy("Match updated.", "მატჩი განახლდა."));
      if (close) onClose();
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy("Could not save this match.", "მატჩის შენახვა ვერ მოხერხდა."),
        ),
      );
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };
  return (
    <div className="tw-modal-backdrop">
      <div
        className="tw-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tw-match-title"
      >
        <div className="tw-section-title">
          <div>
            <p className="tw-eyebrow">
              {fixture.stageName} · {copy("Match", "მატჩი")}{" "}
              {fixture.fixtureOrder}
            </p>
            <h2 id="tw-match-title">
              {copy("Match details", "მატჩის დეტალები")}
            </h2>
          </div>
          <button
            className="tw-icon"
            aria-label={copy("Close", "დახურვა")}
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          {copy(
            "Set the kickoff, record the score, then confirm the result when the match is over.",
            "დანიშნეთ დრო, ჩაწერეთ ანგარიში და დაადასტურეთ შედეგი მატჩის დასრულებისას.",
          )}
        </p>
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
        <div className="tw-score-inputs">
          <label>
            {homeLabel}
            <input
              aria-label={copy("Home score", "მასპინძლის ანგარიში")}
              type="number"
              min={0}
              max={999}
              step={1}
              value={home}
              onChange={(e) => setHome(e.target.value)}
              disabled={
                busy ||
                !canScore ||
                !scoringOpen ||
                fixture.status === "CANCELLED" ||
                fixture.homeEntryId == null
              }
            />
          </label>
          <label>
            {awayLabel}
            <input
              aria-label={copy("Away score", "სტუმრის ანგარიში")}
              type="number"
              min={0}
              max={999}
              step={1}
              value={away}
              onChange={(e) => setAway(e.target.value)}
              disabled={
                busy ||
                !canScore ||
                !scoringOpen ||
                fixture.status === "CANCELLED" ||
                fixture.awayEntryId == null
              }
            />
          </label>
        </div>
        {tied &&
          knockout &&
          canManage &&
          scoringOpen &&
          fixture.status === "SCHEDULED" && (
            <label>
              {copy("Winner after penalties", "გამარჯვებული პენალტების შემდეგ")}
              <select
                value={tieWinner}
                onChange={(e) => setTieWinner(e.target.value)}
              >
                <option value="">
                  {copy("Choose the winner", "აირჩიეთ გამარჯვებული")}
                </option>
                <option value={fixture.homeEntryId ?? ""}>{homeLabel}</option>
                <option value={fixture.awayEntryId ?? ""}>{awayLabel}</option>
              </select>
            </label>
          )}
        {canScore && scoringOpen && fixture.status !== "CANCELLED" && (
          <div className="tw-actions">
            <button
              className="tw-button"
              disabled={
                busy ||
                !validScores ||
                fixture.homeEntryId == null ||
                fixture.awayEntryId == null
              }
              onClick={() =>
                void act(() =>
                  updateFixtureScores(tournament.id, fixture.id, {
                    homeScore: Number(home),
                    awayScore: Number(away),
                  }),
                )
              }
            >
              {copy("Save score", "ანგარიშის შენახვა")}
            </button>
            {canManage && fixture.status === "SCHEDULED" && (
              <button
                className="tw-primary"
                disabled={
                  busy ||
                  !validScores ||
                  fixture.homeEntryId == null ||
                  fixture.awayEntryId == null ||
                  (knockout && winner == null)
                }
                onClick={() =>
                  void act(
                    () =>
                      completeFixture(tournament.id, fixture.id, {
                        homeScore: Number(home),
                        awayScore: Number(away),
                        winnerEntryId: winner,
                      }),
                    true,
                  )
                }
              >
                {copy("Confirm final result", "საბოლოო შედეგის დადასტურება")}
              </button>
            )}
          </div>
        )}
        <VenueReservationSummary value={fixture.venueReservation}/>
        <ExtensionSurface capability="tournamentRefereeManagement"><TournamentFixtureReferees key={`${fixture.id}:${fixture.scheduledAt}:${fixture.status}:${fixture.locationId}`}
          tournamentId={tournament.id} fixtureId={fixture.id} canManage={canManage} scheduledAt={fixture.scheduledAt}
          open={fixture.status === "SCHEDULED" && ["PLANNING", "ACTIVE"].includes(tournament.status)} /></ExtensionSurface>
        {canManage && isExtensionCapabilityAvailable('eventVenueAttachment') && <a className="tw-button" href={`/event-venues?type=TOURNAMENT_FIXTURE&id=${fixture.id}`} target="_blank" rel="noopener noreferrer">{copy('Stadium reservation', 'სტადიონის დაჯავშნა')} ↗<ExtensionDemoLabel capability="eventVenueAttachment" /></a>}
        {canManage &&
          ["PLANNING", "ACTIVE"].includes(tournament.status) &&
          fixture.status === "SCHEDULED" &&
          fixture.linkedMatchId == null && (
            <form
              style={{
                borderTop: "1px solid var(--tw-line)",
                marginTop: 24,
                paddingTop: 20,
              }}
              onSubmit={(e) => {
                e.preventDefault();
                void act(() =>
                  scheduleTournamentFixture(
                    tournament.id,
                    fixture.id,
                    kickoff ? `${kickoff}:00` : null,
                    fixture.locationId,
                  ),
                );
              }}
            >
              <label>
                {copy("Kickoff (local time)", "დაწყება (ადგილობრივი დრო)")}
                <input
                  aria-label={copy("Kickoff", "დაწყების დრო")}
                  type="datetime-local"
                  value={kickoff}
                  onChange={(e) => setKickoff(e.target.value)}
                  min={tournament.startDate?.slice(0, 16)}
                  max={tournament.endDate?.slice(0, 16)}
                  disabled={busy}
                />
              </label>
              <button className="tw-button" type="submit" disabled={busy}>
                {copy("Save kickoff", "დროის შენახვა")}
              </button>
            </form>
          )}
        {canManage && scoringOpen && (
          <details style={{ marginTop: 24, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", color: "var(--tw-muted)" }}>
              {copy("More match actions", "მატჩის სხვა მოქმედებები")}
            </summary>
            <div className="tw-actions">
              {fixture.status === "COMPLETED" && (
                <button
                  className="tw-button"
                  disabled={busy}
                  onClick={() => setConfirm("reopen")}
                >
                  {copy("Reopen match", "მატჩის ხელახლა გახსნა")}
                </button>
              )}
              {fixture.status === "SCHEDULED" && (
                <button
                  className="tw-button tw-danger"
                  disabled={busy}
                  onClick={() => setConfirm("cancel")}
                >
                  {copy("Cancel match", "მატჩის გაუქმება")}
                </button>
              )}
            </div>
          </details>
        )}
        <ConfirmDialog
          open={confirm != null}
          title={
            confirm === "cancel"
              ? copy("Cancel this match?", "გაუქმდეს მატჩი?")
              : copy("Reopen this result?", "გაიხსნას შედეგი ხელახლა?")
          }
          message={
            confirm === "cancel"
              ? copy(
                  "The match will be marked as cancelled in the public schedule.",
                  "საჯარო განრიგში მატჩი გაუქმებულად გამოჩნდება.",
                )
              : copy(
                  "The result and any dependent bracket progress will be checked before reopening.",
                  "გახსნამდე შემოწმდება შედეგი და მასზე დამოკიდებული ბადის პროგრესი.",
                )
          }
          confirmLabel={copy("Confirm", "დადასტურება")}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            void act(
              () =>
                confirm === "cancel"
                  ? cancelFixture(tournament.id, fixture.id)
                  : reopenFixture(tournament.id, fixture.id),
              true,
            )
          }
        />
      </div>
    </div>
  );
}
