import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { participantProfilePath } from "../tournament-readiness";
import { Check, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "../../../components/workspace/useDialogFocus";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { extractApiErrorMessage } from "../../../utils/apiError";
import { tournamentEntryStatusText } from "../../../components/tournaments/tournamentFormatters";
import { addGuestEntry, removeEntry, updateEntryStatus } from "../api";
import type {
  TournamentDetail,
  TournamentEntryDto,
  TournamentEntryStatus,
} from "../domain";
import { participantName } from "../participantLabels";
import { TournamentInvitationsPanel } from "./TournamentInvitationsPanel";
import { CreateTeamModal } from "./CreateTeamModal";

interface Props {
  tournament: TournamentDetail;
  canManage: boolean;
  onUpdate: (t: TournamentDetail) => void;
  onRefresh: () => Promise<void>;
  onBracket: () => void;
}
export function TournamentParticipants({
  tournament,
  canManage,
  onUpdate,
  onRefresh,
  onBracket,
}: Props) {
  const { t, i18n } = useTranslation();
  const copy = (en: string, ka: string) =>
    i18n.language.startsWith("ka") ? ka : en;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"guest" | "invite">("guest");
  const [teamBuilder, setTeamBuilder] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<TournamentEntryDto | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(adding, dialogRef, () => {
    if (!busy) setAdding(false);
  });
  const editable = canManage && tournament.status === "PLANNING";
  const ready = ["ACTIVE", "COMPLETED", "ELIMINATED"];
  const entries = tournament.entries.filter(
    (e) =>
      participantName(e)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "ready"
          ? ready.includes(e.status)
          : ["PENDING", "WAITLISTED", "APPROVED"].includes(e.status))),
  );
  const placed = new Set(
    tournament.fixtures.flatMap((f) => [f.homeEntryId, f.awayEntryId]),
  );
  const change = async (
    entry: TournamentEntryDto,
    status: TournamentEntryStatus,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      onUpdate(await updateEntryStatus(tournament.id, entry.id, { status }));
      setNotice(copy("Participant updated.", "მონაწილე განახლდა."));
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy(
            "Could not update this participant.",
            "მონაწილის განახლება ვერ მოხერხდა.",
          ),
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      onUpdate(await addGuestEntry(tournament.id, name.trim()));
      setNotice(
        copy(
          `${name.trim()} is ready for the draw.`,
          `${name.trim()} მზადაა წილისყრისთვის.`,
        ),
      );
      setName("");
      setAdding(false);
    } catch (err) {
      setError(
        extractApiErrorMessage(
          err,
          copy("Could not add this club.", "კლუბის დამატება ვერ მოხერხდა."),
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="tw-toolbar">
        <div>
          <h2>{copy("Participants", "მონაწილეები")}</h2>
          <p>
            {copy(
              "GrassKickZ clubs and guest teams, together in one tournament.",
              "GrassKickZ-ის კლუბები და სტუმარი გუნდები ერთ ტურნირში.",
            )}
          </p>
        </div>
        <div className="tw-actions">
          {editable && tournament.participantScope === "PLAYER" && (
            <button className="tw-button" onClick={() => setTeamBuilder(true)}>
              {copy("Build team from players", "გუნდის შედგენა მოთამაშეებით")}
            </button>
          )}
          {editable && (
            <button
              className="tw-primary"
              onClick={() => {
                setError("");
                setAdding(true);
              }}
            >
              <Plus size={16} />
              {copy("Add participants", "მონაწილეების დამატება")}
            </button>
          )}
        </div>
      </div>
      <div className="tw-toolbar">
        <label className="tw-search">
          <span className="sr-only">
            {copy("Search participants", "მონაწილეების ძებნა")}
          </span>
          <div className="tw-actions">
            <Search size={17} />
            <input
              className="tw-input"
              style={{ width: "auto", flex: 1, minWidth: 0 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy(
                "Search by team name…",
                "გუნდის სახელის ძებნა…",
              )}
            />
          </div>
        </label>
        <div className="tw-filter">
          {[
            ["all", copy("All", "ყველა")],
            ["ready", copy("Confirmed", "დადასტურებული")],
            ["review", copy("Needs review", "განსახილველი")],
          ].map(([key, label]) => (
            <button
              className="tw-button"
              aria-pressed={filter === key}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}{" "}
              <small>
                {
                  tournament.entries.filter(
                    (e) =>
                      key === "all" ||
                      (key === "ready"
                        ? ready.includes(e.status)
                        : ["PENDING", "WAITLISTED", "APPROVED"].includes(e.status)),
                  ).length
                }
              </small>
            </button>
          ))}
        </div>
      </div>
      {error && !adding && (
        <p className="tw-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="tw-notice" role="status">
          {notice}
        </p>
      )}
      <div className="tw-panel">
        {entries.length === 0 ? (
          <div className="tw-empty">
            <Users />
            <h3>
              {tournament.entries.length
                ? copy("No matching participants", "მონაწილე ვერ მოიძებნა")
                : copy("Who is playing?", "ვინ მონაწილეობს?")}
            </h3>
            <p>
              {copy(
                "Invite a club on GrassKickZ, or add a guest club with just its name. Guest clubs do not need an account or a player roster.",
                "მოიწვიეთ კლუბი GrassKickZ-დან ან დაამატეთ სტუმარი კლუბი მხოლოდ სახელით. ანგარიში ან მოთამაშეთა სია საჭირო არ არის.",
              )}
            </p>
            {editable && (
              <button className="tw-primary" onClick={() => setAdding(true)}>
                <Plus size={16} />
                {copy("Add your first club", "პირველი კლუბის დამატება")}
              </button>
            )}
          </div>
        ) : (
          entries.map((entry) => (
            <div className="tw-entry-row" key={entry.id}>
              <span className="tw-avatar">
                {participantName(entry)
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="tw-entry-name">
                <strong>{participantProfilePath(entry) ? <Link to={participantProfilePath(entry)!}>{participantName(entry)}</Link> : participantName(entry)}</strong>
                <p>
                  {entry.clubId != null
                    ? copy("GrassKickZ club", "GrassKickZ-ის კლუბი")
                    : entry.userId != null
                      ? copy("Player", "მოთამაშე")
                      : entry.draftTeamId != null
                        ? copy("Team", "გუნდი")
                        : copy(
                            "Guest club · no account needed",
                            "სტუმარი კლუბი · ანგარიში საჭირო არ არის",
                          )}
                  {placed.has(entry.id)
                    ? copy(" · In the competition", " · შეჯიბრებაშია")
                    : ready.includes(entry.status)
                      ? copy(" · Ready to place", " · გასანაწილებელია")
                      : ""}
                </p>
              </div>
              <span
                className={`tw-badge ${ready.includes(entry.status) ? "is-ready" : ["PENDING", "WAITLISTED", "APPROVED"].includes(entry.status) ? "is-pending" : ""}`}
              >
                {tournamentEntryStatusText(entry.status, t)}
              </span>
              {editable && (
                <div className="tw-actions">
                  {["PENDING", "WAITLISTED", "APPROVED", "REJECTED"].includes(
                    entry.status,
                  ) ? (
                    <>
                      <button
                        className="tw-button"
                        disabled={busy}
                        onClick={() => void change(entry, "ACTIVE")}
                      >
                        <Check size={14} />
                        {copy("Confirm", "დადასტურება")}
                      </button>
                      <select
                        aria-label={`${copy("Other actions for", "სხვა მოქმედებები:")} ${participantName(entry)}`}
                        value=""
                        style={{ width: 100, minHeight: 40, fontSize: 12 }}
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.value)
                            void change(
                              entry,
                              e.target.value as TournamentEntryStatus,
                            );
                        }}
                      >
                        <option value="">{copy("More", "მეტი")}</option>
                        {entry.status !== "WAITLISTED" &&
                          entry.status !== "REJECTED" && (
                            <option value="WAITLISTED">
                              {copy("Waitlist", "მოლოდინის სია")}
                            </option>
                          )}
                        {entry.status !== "REJECTED" && (
                          <option value="REJECTED">
                            {copy("Decline", "უარყოფა")}
                          </option>
                        )}
                      </select>
                    </>
                  ) : (
                    ["ACTIVE"].includes(entry.status) && (
                      <button className="tw-button" onClick={onBracket}>
                        {placed.has(entry.id)
                          ? copy("View in competition", "შეჯიბრებაში ნახვა")
                          : copy("Place in competition", "შეჯიბრებაში განაწილება")}
                      </button>
                    )
                  )}
                  <button
                    className="tw-icon tw-danger"
                    aria-label={`${copy("Remove", "წაშლა")} ${participantName(entry)}`}
                    disabled={busy}
                    onClick={() => setRemoving(entry)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {canManage && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", padding: 12 }}>
            {copy("Invitations and responses", "მოწვევები და პასუხები")}
          </summary>
          <div className="tw-panel">
            <TournamentInvitationsPanel tournamentId={tournament.id} />
          </div>
        </details>
      )}
      <div hidden={!adding}>
        {adding && (
          <div className="tw-modal-backdrop">
            <div
              className="tw-dialog"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tw-add-title"
            >
              <div className="tw-section-title">
                <h2 id="tw-add-title">
                  {copy("Add participants", "მონაწილეების დამატება")}
                </h2>
                <button
                  className="tw-icon"
                  disabled={busy}
                  aria-label={copy("Close", "დახურვა")}
                  onClick={() => setAdding(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="tw-tabs" style={{ marginTop: 18 }}>
                <button
                  aria-pressed={mode === "guest"}
                  onClick={() => setMode("guest")}
                  disabled={busy}
                >
                  {copy("Guest club", "სტუმარი კლუბი")}
                </button>
                <button
                  aria-pressed={mode === "invite"}
                  onClick={() => setMode("invite")}
                  disabled={busy}
                >
                  {copy("Invite from GrassKickZ", "მოწვევა GrassKickZ-დან")}
                </button>
              </div>
              {error && (
                <p className="tw-error" role="alert">
                  {error}
                </p>
              )}
              {mode === "guest" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void add();
                  }}
                >
                  <p
                    style={{ color: "var(--tw-muted)", fontSize: 13, marginBottom: 20 }}
                  >
                    {copy(
                      "A club, company team or group of friends can join without signing up. Add their name and they are ready for the competition.",
                      "კლუბი, კომპანიის გუნდი ან მეგობრები რეგისტრაციის გარეშე მონაწილეობენ. დაამატეთ სახელი და გუნდი მზად იქნება წილისყრისთვის.",
                    )}
                  </p>
                  <label>
                    {copy("Club or team name", "კლუბის ან გუნდის სახელი")}
                    <input
                      required
                      maxLength={120}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={copy(
                        "e.g. Riverside FC",
                        "მაგ. რივერსაიდ FC",
                      )}
                      disabled={busy}
                    />
                  </label>
                  <div className="tw-actions">
                    <button
                      type="button"
                      className="tw-button"
                      disabled={busy}
                      onClick={() => setAdding(false)}
                    >
                      {copy("Cancel", "გაუქმება")}
                    </button>
                    <button
                      className="tw-primary"
                      type="submit"
                      disabled={busy || !name.trim()}
                    >
                      {busy
                        ? copy("Adding…", "ემატება…")
                        : copy("Add guest club", "სტუმარი კლუბის დამატება")}
                    </button>
                  </div>
                </form>
              ) : (
                <TournamentInvitationsPanel tournamentId={tournament.id} />
              )}
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!removing}
        title={copy("Remove participant?", "წაიშალოს მონაწილე?")}
        message={copy(
          `Remove ${participantName(removing ?? undefined)} from this tournament? Their competition places will also be cleared.`,
          `წაიშალოს ${participantName(removing ?? undefined)} ტურნირიდან? ბადეში მისი ადგილებიც გასუფთავდება.`,
        )}
        confirmLabel={copy("Remove participant", "მონაწილის წაშლა")}
        variant="danger"
        onCancel={() => {
          if (!busy) setRemoving(null);
        }}
        onConfirm={async () => {
          if (!removing || busy) return;
          setBusy(true);
          setError("");
          try {
            await removeEntry(tournament.id, removing.id);
            await onRefresh();
            setRemoving(null);
          } catch (err) {
            setError(
              extractApiErrorMessage(
                err,
                copy(
                  "Could not remove participant.",
                  "მონაწილის წაშლა ვერ მოხერხდა.",
                ),
              ),
            );
            setRemoving(null);
          } finally {
            setBusy(false);
          }
        }}
      />
      {teamBuilder && (
        <CreateTeamModal
          tournamentId={tournament.id}
          entries={tournament.entries}
          onClose={() => setTeamBuilder(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
