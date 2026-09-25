import { useLoad, useAction } from "./hooks";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ages,
  formats,
  levels,
  label,
  post,
  put,
  type Match,
  type Squad,
  changeImpactFrom,
  type ChangeImpact,
} from "./api";
import { MatchChangeImpact } from "./MatchChangeImpact";
import type { Venue } from "../venues/api";
import { ArrangementEditor } from './ArrangementEditor';
const GroundPicker = lazy(() => import('./GroundPicker'));

export function ListingEditor(props: { initial?: Match; onClose: () => void }) {
  return props.initial ? <ExistingListingEditor {...props} /> : <ArrangementEditor onClose={props.onClose} />;
}
function ExistingListingEditor({
  initial,
  onClose,
}: {
  initial?: Match;
  onClose: () => void;
}) {
  const navigate = useNavigate(),
    { data: squads } = useLoad<Squad[]>("/match-exchange/squads"),
    { data: venues } = useLoad<{ content: Venue[] }>("/venues?size=50");
  const [draft, setDraft] = useState({
    squadId: initial?.squad_id || 0,
    title: initial?.title || "",
    description: initial?.description || "",
    startsAt: initial?.starts_at.slice(0, 16) || "",
    endsAt: initial?.ends_at.slice(0, 16) || "",
    timezone:
      initial?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    city: initial?.city || "",
    locationName: initial?.location_name || "",
    latitude: initial?.location_lat?.toString() || "",
    longitude: initial?.location_lng?.toString() || "",
    ageGroup: initial?.age_group || "U12",
    level: initial?.level || "DEVELOPMENT",
    format: initial?.format || "7_A_SIDE",
    venuePreference: initial?.venue_preference || "HOME",
    refereeRequired: initial?.referee_required ?? true,
    venueId: initial?.venue_id || 0,
    requestId: crypto.randomUUID(),
    revision: initial?.revision || 0,
  });
  const { busy, run, feedback } = useAction(() => {});
  const [impact, setImpact] = useState<ChangeImpact>();
  function field(key: keyof typeof draft, value: string | number | boolean) {
    setImpact(undefined);
    setDraft((v) => ({ ...v, [key]: value }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const payload = {
        ...draft,
        squadId: Number(draft.squadId),
        venueId: Number(draft.venueId) || null,
        latitude: draft.latitude === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === "" ? null : Number(draft.longitude),
      };
      let result;
      try {
        result = initial
          ? await put(`/match-exchange/${initial.event_id}`, payload, impact?.confirmationToken)
          : await post("/match-exchange", payload);
      } catch (error) {
        setImpact(changeImpactFrom(error));
        throw error;
      }
      onClose();
      navigate(`/match-exchange/${result.event_id}`);
    }, "Listing saved");
  }
  return (
    <section className="mx-panel">
      <h2>{initial ? "Edit match listing" : "Find your next opponent"}</h2>
      <p className="mx-muted">
        This publishes the squad, match time and meeting location to Match
        Exchange. Player and parent details stay private.
      </p>
      {initial && (
        <p className="mx-notice">
          Changes to match terms require a review of affected arrangements.
          Title edits preserve existing agreements. Description edits require
          review because they can change playing rules. Resolve any
          affected stadium reservation or external ground confirmation first.
        </p>
      )}
      {feedback}
      {impact && <MatchChangeImpact impact={impact} />}
      <form className="mx-form" onSubmit={submit}>
        <label>
          Hosting squad
          <select
            required
            disabled={!!initial}
            value={draft.squadId}
            onChange={(e) => field("squadId", Number(e.target.value))}
          >
            <option value={0} disabled>
              Choose your squad
            </option>
            {squads?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.club_name} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input
            required
            maxLength={140}
            value={draft.title}
            onChange={(e) => field("title", e.target.value)}
            placeholder="U12 friendly — looking for an opponent"
          />
        </label>
        <label>
          Starts
          <input
            required
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => field("startsAt", e.target.value)}
          />
        </label>
        <label>
          Ends
          <input
            required
            type="datetime-local"
            value={draft.endsAt}
            onChange={(e) => field("endsAt", e.target.value)}
          />
        </label>
        <label>
          Time zone
          <input
            required
            value={draft.timezone}
            onChange={(e) => field("timezone", e.target.value)}
            list="mx-timezones"
          />
          <datalist id="mx-timezones">
            <option>Asia/Tbilisi</option>
            <option>Europe/London</option>
            <option>Europe/Tallinn</option>
          </datalist>
        </label>
        <label>
          City
          <input
            required
            maxLength={120}
            value={draft.city}
            onChange={(e) => field("city", e.target.value)}
          />
        </label>
        <label>
          Age group
          <select
            value={draft.ageGroup}
            onChange={(e) => field("ageGroup", e.target.value)}
          >
            {ages.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          Playing level
          <select
            value={draft.level}
            onChange={(e) => field("level", e.target.value)}
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {label(l)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select
            value={draft.format}
            onChange={(e) => field("format", e.target.value)}
          >
            {Object.entries(formats).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Home / away
          <select
            value={draft.venuePreference}
            onChange={(e) => field("venuePreference", e.target.value)}
          >
            <option value="HOME">We host</option>
            <option value="AWAY">We travel</option>
            <option value="EITHER">Either</option>
          </select>
        </label>
        <label className="mx-wide">
          Stadium
          <select
            value={draft.venueId}
            onChange={(e) => {
              const id = Number(e.target.value),
                v = venues?.content.find((v) => v.id === id);
              setDraft((d) => ({
                ...d,
                venueId: id,
                ...(v
                  ? {
                      city: v.city,
                      locationName: v.addressText,
                      latitude: String(v.latitude ?? ""),
                      longitude: String(v.longitude ?? ""),
                      timezone: v.timezone,
                    }
                  : {}),
              }));
            }}
          >
            <option value={0}>External ground / venue to arrange</option>
            {venues?.content.map((v) => (
              <option key={v.id} value={v.id}>
                {v.displayName} · {v.city}
              </option>
            ))}
          </select>
        </label>
        <label className="mx-wide">
          Meeting location
          <input
            required
            maxLength={255}
            value={draft.locationName}
            onChange={(e) => field("locationName", e.target.value)}
            placeholder="Ground name, or meeting location to be agreed"
          />
        </label>
        <Suspense fallback={<p>Loading ground map…</p>}><GroundPicker latitude={draft.latitude} longitude={draft.longitude} onChange={(latitude,longitude) => { field('latitude',latitude); field('longitude',longitude); }} /></Suspense>
        <label className="mx-wide">
          Match details
          <textarea
            maxLength={2000}
            value={draft.description}
            onChange={(e) => field("description", e.target.value)}
            placeholder="Playing time, rules, kit colours and anything the other coach should know."
          />
        </label>
        <label className="mx-check mx-wide">
          <input
            type="checkbox"
            checked={draft.refereeRequired}
            onChange={(e) => field("refereeRequired", e.target.checked)}
          />{" "}
          A referee is required
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="mx-primary" disabled={busy || !draft.squadId}>
            {initial ? impact?.confirmationRequired && !impact.needsAttention.length ? "Confirm changes and notify participants" : "Review and save changes" : "Publish listing"}
          </button>
        </footer>
      </form>
    </section>
  );
}
