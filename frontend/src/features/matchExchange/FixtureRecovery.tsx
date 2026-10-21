import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { changeImpactFrom, hasBlockingAttention, post, type ChangeImpact, type Match } from "./api";
import { extractApiErrorMessage } from "../../utils/apiError";
import { MatchChangeImpact } from "./MatchChangeImpact";
import { useJourneyCopy } from "./journeyCopy";

export function FixtureCancellation({ match: m, reload, started }: { match: Match; reload: () => void; started: boolean }) {
  const { copy } = useJourneyCopy();
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [impact, setImpact] = useState<ChangeImpact>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const inFlight = useRef(false);
  const reviewed = impact?.revision === m.revision && !hasBlockingAttention(impact);
  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const request = { revision: m.revision, requestId, reason };
    try {
      if (!reviewed) setImpact(await post(`/match-exchange/${m.event_id}/close-preview`, request));
      else { await post(`/match-exchange/${m.event_id}/close`, request, impact?.confirmationToken); reload(); }
    } catch (e) {
      const current = changeImpactFrom(e); setImpact(current);
      if (isAxiosError(e) && e.response?.status === 409 && !current) { setError(copy("conflict")); reload(); }
      else if (!current) setError(extractApiErrorMessage(e, copy("failed")));
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="mx-panel">
    <button onClick={() => setOpen(v => !v)} aria-expanded={open}>{copy("cancelFixture")}</button>
    {open && <form className="mx-stack mx-followup" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <p>{copy("cancelHelp")}</p>
      <label>{copy("cancelReason")}<textarea required={started} maxLength={1000} value={reason} onChange={e => { setReason(e.target.value); setImpact(undefined); }} /></label>
      <p className="mx-muted">{copy("reasonPrivacy")}</p>
      {error && <p role="alert" className="mx-error">{error}</p>}
      {impact && <MatchChangeImpact impact={impact} />}
      <button disabled={busy || started && !reason.trim()}>{copy(reviewed ? "confirmCancel" : "reviewCancel")}</button>
    </form>}
  </section>;
}

export function VenueFollowUp({ match: m, reload }: { match: Match; reload: () => void }) {
  const { copy } = useJourneyCopy();
  const [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const inFlight = useRef(false);
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try { await post(`/match-exchange/${m.event_id}/external-venue-resolution`, { revision: m.revision, requestId, reason }); setMessage(copy("resolutionSaved")); reload(); }
    catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) { setMessage(copy("conflict")); reload(); }
      else setMessage(extractApiErrorMessage(e, copy("failed")));
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="mx-panel">
    <h2>{copy("venueFollowup")}</h2>
    <p>{copy(m.booking_id ? "bookingFollowup" : "externalFollowup")}</p>
    {message && <p role="status" className="mx-notice">{message}</p>}
    {m.can_manage && m.external_venue_confirmed && !m.booking_id && <form className="mx-stack mx-followup" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>{copy("resolution")}<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button disabled={busy || !reason.trim()}>{copy("saveResolution")}</button>
    </form>}
  </section>;
}
