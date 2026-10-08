import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useResultText } from "../matchHistory/copy";
import { useAuth } from "../../context/AuthContext";
import { extractApiErrorMessage } from "../../utils/apiError";
import {
  getMatchResult,
  writeMatchResult,
  type Match,
  type MatchResultState,
  type ResultSide,
} from "./api";

const sideName: Record<ResultSide, string> = { HOME: "Home team", AWAY: "Away team", REFEREE: "Lead referee" };
const sides: ResultSide[] = ["HOME", "AWAY", "REFEREE"];
const validSides = (values: ResultSide[] | undefined) => sides.filter(side => values?.includes(side));
const score = (home: number | null, away: number | null) => home == null || away == null ? null : `${home} – ${away}`;

export function MatchResult({ match, reload }: { match: Match; reload: () => void }) {
  const { sessionId } = useAuth();
  const text = useResultText();
  const [result, setResult] = useState<MatchResultState>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [reason, setReason] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [chosenSide, setChosenSide] = useState<ResultSide | "">("");
  const loadController = useRef<AbortController | undefined>(undefined);
  const writeController = useRef<AbortController | undefined>(undefined);
  const inFlight = useRef(false);
  const draftRevision = useRef<number | null>(null);
  const activeRef = useRef("");
  const active = `${sessionId ?? "anonymous"}:${match.event_id}`;
  const visible = activeRef.current === active ? result : undefined;
  const cancelled = (visible?.fixtureStatus ?? match.event_status) === "CANCELLED";

  const load = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const request = activeRef.current;
    try {
      const next = await getMatchResult(match.event_id, controller.signal, sessionId);
      if (controller.signal.aborted || activeRef.current !== request) return;
      setResult(current => current && current.revision > next.revision ? current : next);
      if (draftRevision.current !== null && next.revision > draftRevision.current) {
        draftRevision.current = null;
        setHome(""); setAway(""); setReason("");
        setCorrectionOpen(false); setDisputeOpen(false);
        setNotice(text("The result changed. Review the latest version before editing again."));
      }
      setError("");
    } catch (cause) {
      if (controller.signal.aborted || activeRef.current !== request) return;
      if (isAxiosError(cause) && [403, 404].includes(cause.response?.status ?? 0)) setResult(undefined);
      setError(extractApiErrorMessage(cause, text("Could not load the match result.")));
    }
  }, [match.event_id, sessionId, text]);

  useEffect(() => {
    activeRef.current = active;
    setResult(undefined);
    setError("");
    setNotice("");
    setHome("");
    setAway("");
    setReason("");
    setChosenSide("");
    draftRevision.current = null;
    setCorrectionOpen(false);
    setDisputeOpen(false);
    inFlight.current = false;
    setBusy(false);
    void load();
    const refresh = () => { if (document.visibilityState === "visible" && !inFlight.current) void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      activeRef.current = "";
      loadController.current?.abort();
      writeController.current?.abort();
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [active, load]);

  async function submit(action: "propose" | "confirm" | "dispute" | "correct", side: ResultSide) {
    if (!visible || cancelled || inFlight.current) return;
    if (action !== "confirm" && draftRevision.current !== null && draftRevision.current !== visible.revision) {
      draftRevision.current = null;
      setHome(""); setAway(""); setReason("");
      setCorrectionOpen(false); setDisputeOpen(false);
      setNotice(text("The result changed. Review the latest version before editing again."));
      return;
    }
    const numericHome = Number(home), numericAway = Number(away), trimmedReason = reason.trim();
    if ((action === "propose" || action === "correct") && (!home || !away || !Number.isInteger(numericHome) || !Number.isInteger(numericAway) || numericHome < 0 || numericAway < 0 || numericHome > 100 || numericAway > 100)) return;
    if ((action === "dispute" || action === "correct") && !trimmedReason) return;
    const body = {
      side, revision: action === "confirm" ? visible.revision : draftRevision.current ?? visible.revision, requestId: crypto.randomUUID(),
      ...(action === "propose" || action === "correct" ? { homeScore: numericHome, awayScore: numericAway } : {}),
      ...(action === "dispute" || action === "correct" ? { reason: trimmedReason } : {}),
    };
    inFlight.current = true;
    loadController.current?.abort();
    setBusy(true);
    setError("");
    setNotice("");
    const request = activeRef.current;
    const controller = new AbortController();
    writeController.current = controller;
    try {
      const next = await writeMatchResult(match.event_id, action, body, controller.signal, sessionId);
      if (controller.signal.aborted || activeRef.current !== request) return;
      setResult(next);
      draftRevision.current = null;
      setHome(""); setAway(""); setReason("");
      setCorrectionOpen(false); setDisputeOpen(false);
      setNotice(action === "propose" ? text("Score proposed. Awaiting confirmation.") : action === "confirm" ? text("Confirmation recorded.") : action === "dispute" ? text("Result disputed. The score is under review.") : text("Correction proposed. Fresh confirmations are required."));
      reload();
    } catch (cause) {
      if (controller.signal.aborted || activeRef.current !== request) return;
      if (isAxiosError(cause) && cause.response?.status === 409) {
        setCorrectionOpen(false); setDisputeOpen(false);
        draftRevision.current = null;
        setHome(""); setAway(""); setReason("");
        setNotice(text("The result changed. Review the latest version before trying again."));
        void load();
        reload();
      } else {
        if (isAxiosError(cause) && [403, 404].includes(cause.response?.status ?? 0)) setResult(undefined);
        setError(extractApiErrorMessage(cause, text("Could not update the match result. Please try again.")));
      }
    } finally {
      if (activeRef.current === request) { inFlight.current = false; setBusy(false); }
    }
  }

  if (!visible) return <section id="result" className="mx-panel" aria-busy={!error} aria-label={text("Match result")}><h2>{text("Match result")}</h2>{error ? <><p role="alert" className="mx-error">{error}</p><button type="button" onClick={() => void load()}>{text("Retry result")}</button></> : <p className="mx-muted">{text("Loading result…")}</p>}</section>;

  const proposalSides = validSides(visible.authority.roles);
  const correctionSides = validSides(visible.authority.correctableRoles);
  const disputeSides = validSides(visible.authority.roles);
  const selectedProposalSide = proposalSides.includes(chosenSide as ResultSide) ? chosenSide : proposalSides[0] ?? "";
  const selectedCorrectionSide = correctionSides.includes(chosenSide as ResultSide) ? chosenSide : correctionSides[0] ?? "";
  const selectedDisputeSide = disputeSides.includes(chosenSide as ResultSide) ? chosenSide : disputeSides[0] ?? "";
  const displayedScore = score(visible.homeScore, visible.awayScore);
  const missing = visible.requiredConfirmations.filter(side => !visible.confirmations.includes(side));

  return <section id="result" className="mx-panel" aria-label={text("Match result")}>
    <div className="mx-actions"><h2>{text("Match result")}</h2><button type="button" disabled={busy} onClick={() => void load()}>{text("Refresh result")}</button></div>
    {visible.status === "CONFIRMED" && (visible.legacy ? <p role="status"><strong>{text("Previously recorded result")}{displayedScore ? `: ${displayedScore}` : ""}</strong>. {text("Confirmation evidence is unavailable for this older record.")}</p> : <p role="status"><strong>{text("Confirmed result")}{displayedScore ? `: ${displayedScore}` : ""}</strong></p>)}
    {visible.status === "PROPOSED" && <><p role="status"><strong>{text("Proposed score")}{displayedScore ? `: ${displayedScore}` : ""}</strong> · {text("awaiting confirmation")}</p><p className="mx-muted">{text("Proposed by")} {visible.proposalSide ? text(sideName[visible.proposalSide]) : text("a match participant")}. {missing.length ? `${text("Still needed")}: ${missing.map(side => text(sideName[side])).join(", ")}.` : text("Confirmations are being checked.")}</p></>}
    {visible.status === "DISPUTED" && <p role="status" className="mx-notice"><strong>{text("Result disputed.")}</strong> {text("The score is under review")}{displayedScore ? ` (${text("disputed score")}: ${displayedScore})` : ""}.</p>}
    {visible.status === "NONE" && <p className="mx-muted">{visible.legacy && displayedScore ? `${text("Previously recorded score")}: ${displayedScore}. ${text("This has not been confirmed through the current result process.")}` : text("No result has been proposed.")}</p>}
    {cancelled && <p className="mx-muted">{text("This cancelled fixture’s result history is read only.")}</p>}
    {error && <p role="alert" className="mx-error">{error}</p>}
    {notice && <p role="status" className="mx-notice">{notice}</p>}

    {!cancelled && visible.authority.canPropose && proposalSides.length > 0 && visible.status === "NONE" && <form className="mx-form" onSubmit={event => { event.preventDefault(); void submit("propose", selectedProposalSide as ResultSide); }}>
      <h3 className="mx-wide">{text("Propose a score")}</h3>
      <ScoreInputs match={match} home={home} away={away} disabled={busy} onHome={value => { draftRevision.current ??= visible.revision; setHome(value); }} onAway={value => { draftRevision.current ??= visible.revision; setAway(value); }}/>
      {proposalSides.length > 1 && <SideSelect values={proposalSides} value={selectedProposalSide} onChange={setChosenSide} disabled={busy}/>}
      <p className="mx-muted mx-wide">{text("A proposed score becomes final only after the required independent confirmations.")}</p>
      <footer><button className="mx-primary" disabled={busy || !selectedProposalSide}>{text("Propose score")}</button></footer>
    </form>}

    {!cancelled && visible.status === "PROPOSED" && validSides(visible.authority.confirmableRoles).map(side => <button key={side} type="button" disabled={busy} onClick={() => void submit("confirm", side)}>{text("Confirm as")} {text(sideName[side])}</button>)}

    {!cancelled && visible.authority.canDispute && disputeSides.length > 0 && ["PROPOSED", "CONFIRMED"].includes(visible.status) && <div>
      <button type="button" disabled={busy} aria-expanded={disputeOpen} onClick={() => { draftRevision.current = disputeOpen ? null : visible.revision; setDisputeOpen(!disputeOpen); setCorrectionOpen(false); setReason(""); }}>{text("Dispute result")}</button>
      {disputeOpen && <form className="mx-form" onSubmit={event => { event.preventDefault(); void submit("dispute", selectedDisputeSide as ResultSide); }}>
        {disputeSides.length > 1 && <SideSelect values={disputeSides} value={selectedDisputeSide} onChange={setChosenSide} disabled={busy}/>}
        <label className="mx-wide">{text("Reason for dispute")}<textarea required maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label>
        <footer><button disabled={busy || !reason.trim()}>{text("Submit dispute")}</button></footer>
      </form>}
    </div>}

    {!cancelled && visible.authority.canCorrect && correctionSides.length > 0 && <div>
      <button type="button" disabled={busy} aria-expanded={correctionOpen} onClick={() => { draftRevision.current = correctionOpen ? null : visible.revision; setCorrectionOpen(!correctionOpen); setDisputeOpen(false); setHome(visible.homeScore == null ? "" : String(visible.homeScore)); setAway(visible.awayScore == null ? "" : String(visible.awayScore)); setReason(""); }}>{text("Propose correction")}</button>
      {correctionOpen && <form className="mx-form" onSubmit={event => { event.preventDefault(); void submit("correct", selectedCorrectionSide as ResultSide); }}>
        <h3 className="mx-wide">{text("Correct the score")}</h3>
        <ScoreInputs match={match} home={home} away={away} disabled={busy} onHome={setHome} onAway={setAway}/>
        {correctionSides.length > 1 && <SideSelect values={correctionSides} value={selectedCorrectionSide} onChange={setChosenSide} disabled={busy}/>}
        <label className="mx-wide">{text("Reason for correction")}<textarea required maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label>
        <p className="mx-muted mx-wide">{text("A correction needs a new round of confirmations.")}</p>
        <footer><button disabled={busy || !reason.trim()}>{text("Submit correction")}</button></footer>
      </form>}
    </div>}

    <details><summary>{text("Result history")} ({visible.history.length})</summary>
      {visible.history.length ? <ol>{visible.history.map(item => <li key={item.id}><strong>{text(item.action.replaceAll("_", " ").toLowerCase())}</strong> · {item.actor_side ? text(sideName[item.actor_side]) : item.action === "IMPORTED" ? text("Historical record") : text("Match participant")} · <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>{score(item.home_score, item.away_score) && <> · {score(item.home_score, item.away_score)}</>}{item.reason && <p>{item.reason}</p>}</li>)}</ol> : <p className="mx-muted">{text("No result actions yet.")}</p>}
    </details>
  </section>;
}

function ScoreInputs({ match, home, away, disabled, onHome, onAway }: { match: Match; home: string; away: string; disabled: boolean; onHome: (value: string) => void; onAway: (value: string) => void }) {
  const text = useResultText();
  return <><label>{match.club_name} {text("score")}<input type="number" required min={0} max={100} step={1} value={home} disabled={disabled} onChange={event => onHome(event.target.value)}/></label><label>{match.opponent_name || text("Away team")} {text("score")}<input type="number" required min={0} max={100} step={1} value={away} disabled={disabled} onChange={event => onAway(event.target.value)}/></label></>;
}

function SideSelect({ values, value, onChange, disabled }: { values: ResultSide[]; value: ResultSide | ""; onChange: (value: ResultSide) => void; disabled: boolean }) {
  const text = useResultText();
  return <label className="mx-wide">{text("Acting as")}<select value={value} disabled={disabled} onChange={event => onChange(event.target.value as ResultSide)}>{values.map(side => <option key={side} value={side}>{text(sideName[side])}</option>)}</select></label>;
}
