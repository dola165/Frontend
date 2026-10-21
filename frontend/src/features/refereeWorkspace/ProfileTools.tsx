import { EmptyState } from '../../components/ui/EmptyState';
import { useState, type FormEvent } from 'react';
import { Status } from '../matchExchange/shared';
import { Link } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { useAction } from '../matchExchange/hooks';
import { label, formats, post, put, when, type Referee } from '../matchExchange/api';
export function ProfileEditor({
  profile: r,
  onSaved,
  canManage = true,
}: {
  profile: Referee | null;
  onSaved: () => void;
  canManage?: boolean;
}) {
  const [draft, setDraft] = useState({
    published: r?.published || false,
    biography: r?.biography || "",
    qualifications: r?.qualifications || "",
    formats: r?.formats || "7_A_SIDE,11_A_SIDE",
    languages: r?.languages || "",
    serviceArea: r?.service_area || "",
    travelKm: r?.travel_km ?? 30,
    acceptsPaid: r?.accepts_paid ?? true,
    acceptsVolunteer: r?.accepts_volunteer ?? false,
    fee: r?.fee || 0,
    currency: r?.currency || "GEL",
    timezone: r?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    revision: r?.revision || 0,
  });
  const { run, busy, feedback } = useAction(onSaved);
  function field(k: keyof typeof draft, v: string | number | boolean) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  return (
    <section className="mx-panel">
      <h2>{r ? "Edit referee profile" : "Set up your referee profile"}</h2>
      {feedback}
      <form
        className="mx-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canManage) void run(() => put("/referees/me", draft));
        }}
      >
        <label className="mx-wide">
          About your officiating
          <textarea
            maxLength={3000}
            value={draft.biography}
            onChange={(e) => field("biography", e.target.value)}
          />
        </label>
        <label className="mx-wide">
          Qualifications (self-reported)
          <textarea
            maxLength={2000}
            value={draft.qualifications}
            onChange={(e) => field("qualifications", e.target.value)}
          />
        </label>
        <fieldset className="mx-wide">
          <legend style={{ fontSize: 12, marginBottom: 10 }}>
            Formats you officiate
          </legend>
          <div className="mx-actions">
            {Object.entries(formats).map(([k, v]) => (
              <label className="mx-check" key={k}>
                <input
                  type="checkbox"
                  checked={draft.formats.split(",").includes(k)}
                  onChange={(e) =>
                    field(
                      "formats",
                      e.target.checked
                        ? [...draft.formats.split(",").filter(Boolean), k].join(
                            ",",
                          )
                        : draft.formats
                            .split(",")
                            .filter((v) => v !== k)
                            .join(","),
                    )
                  }
                />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Languages
          <input
            maxLength={200}
            value={draft.languages}
            onChange={(e) => field("languages", e.target.value)}
          />
        </label>
        <label>
          Service area
          <input
            maxLength={200}
            value={draft.serviceArea}
            onChange={(e) => field("serviceArea", e.target.value)}
            placeholder="Tbilisi / Cardiff / Tallinn"
          />
        </label>
        <label>
          Travel radius (km)
          <input
            type="number"
            min={0}
            max={2000}
            value={draft.travelKm}
            onChange={(e) => field("travelKm", Number(e.target.value))}
          />
        </label>
        <label>
          Time zone
          <input
            required
            value={draft.timezone}
            onChange={(e) => field("timezone", e.target.value)}
          />
        </label>
        <label>
          Starting fee per match
          <input
            type="number"
            min={0}
            max={1000000}
            step="0.01"
            value={draft.fee}
            onChange={(e) => field("fee", Number(e.target.value))}
          />
        </label>
        <label>
          Currency
          <select
            value={draft.currency}
            onChange={(e) => field("currency", e.target.value)}
          >
            {["GEL", "EUR", "GBP", "USD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="mx-check">
          <input
            type="checkbox"
            checked={draft.acceptsPaid}
            onChange={(e) => field("acceptsPaid", e.target.checked)}
          />{" "}
          Accept paid invitations
        </label>
        <label className="mx-check">
          <input
            type="checkbox"
            checked={draft.acceptsVolunteer}
            onChange={(e) => field("acceptsVolunteer", e.target.checked)}
          />{" "}
          Accept volunteer invitations
        </label>
        <label className="mx-check mx-wide">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => field("published", e.target.checked)}
          />{" "}
          Publish in the referee directory
        </label>
        <p className="mx-muted mx-wide">
          Your profile, qualifications and career entries will be visible. Your
          availability windows, invitations and match reports stay private to
          the relevant people. Fees are agreed directly; online payments come
          later.
        </p>
        <footer>
          {!canManage && <p role="status">Your access changed. Your draft is still here; refresh your access before saving.</p>}
          <button disabled={busy || !canManage} className="mx-primary">
            Save profile
          </button>
        </footer>
      </form>
    </section>
  );
}
export function AvailabilityForm({ reload, startsAt, endsAt }: { reload: () => void; startsAt?: string; endsAt?: string }) {
  const local = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';
  const [start, setStart] = useState(() => local(startsAt)),
    [end, setEnd] = useState(() => local(endsAt)),
    { run, busy, feedback } = useAction(() => { setStart(''); setEnd(''); reload(); });
  return (
    <section className="mx-panel">
      <h2>Add availability</h2>
      <p className="mx-muted">
        Times are entered in your device time zone:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}.
      </p>
      {feedback}
      <form
        className="mx-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () =>
              post("/referees/me/availability", {
                startsAt: new Date(start).toISOString(),
                endsAt: new Date(end).toISOString(),
              }),
            "Availability saved",
          );
        }}
      >
        <label>
          From
          <input
            required
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Until
          <input
            required
            type="datetime-local"
            min={start || undefined}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button className="mx-primary" disabled={busy}>
          Add window
        </button>
      </form>
    </section>
  );
}
export function CareerForm({ reload }: { reload: () => void }) {
  const { run, busy, feedback } = useAction(reload);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(
      () =>
        post("/referees/me/career", {
          kind: f.get("kind"),
          title: f.get("title"),
          organization: f.get("organization"),
          startsOn: f.get("startsOn"),
          endsOn: f.get("endsOn") || null,
          description: f.get("description"),
        }),
      "Career entry saved",
    );
  }
  return (
    <section className="mx-panel">
      <h2>Add experience</h2>
      {feedback}
      <form className="mx-stack" onSubmit={submit}>
        <label>
          Type
          <select name="kind">
            <option value="CAREER">Career</option>
            <option value="QUALIFICATION">Qualification</option>
            <option value="VOLUNTEERING">Volunteering</option>
          </select>
        </label>
        <label>
          Title
          <input required name="title" maxLength={160} />
        </label>
        <label>
          Organization
          <input name="organization" maxLength={160} />
        </label>
        <label>
          Start date
          <input required type="date" name="startsOn" />
        </label>
        <label>
          End date (leave blank if ongoing)
          <input type="date" name="endsOn" />
        </label>
        <label>
          Details
          <textarea name="description" maxLength={2000} />
        </label>
        <button disabled={busy} className="mx-primary">
          Add experience
        </button>
        <small>
          Shown as self-reported experience on your referee profile.
        </small>
      </form>
    </section>
  );
}
export function CareerTimeline({
  profile: r,
  onRemove,
}: {
  profile: Referee;
  onRemove?: (id: number) => void;
}) {
  return (
    <section className="mx-panel">
      <h2>Career & volunteering</h2>
      <small>Self-reported experience</small>
      <div className="mx-timeline">
        {!r.career?.length && (
          <EmptyState compact icon={HeartHandshake} title="No career entries yet." description="Add your experience, qualifications and volunteering to explain your background to clubs. These entries are self-reported."/>
        )}
        {r.career?.map((c) => (
          <article key={c.id}>
            <div className="mx-actions">
              {c.kind === "VOLUNTEERING" && <HeartHandshake size={16} />}
              <span className="mx-eyebrow">{label(c.kind)}</span>
            </div>
            <h3>{c.title}</h3>
            <p>{c.organization}</p>
            <small>
              {c.kind === "QUALIFICATION" ? "Awarded " : ""}
              {new Date(
                c.starts_on.slice(0, 10) + "T12:00:00Z",
              ).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
              {c.ends_on ? (c.kind === "QUALIFICATION" ? " · Valid until " : " — ") : ""}
              {c.ends_on
                ? new Date(
                    c.ends_on.slice(0, 10) + "T12:00:00Z",
                  ).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : c.kind === "QUALIFICATION" ? "" : " — Present"}
            </small>
            <p className="mx-prose" style={{ marginTop: 10 }}>
              {c.description}
            </p>
            {onRemove && (
              <button className="mx-link-button" onClick={() => onRemove(c.id)}>
                Remove entry
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
export function MatchHistory({ profile: r }: { profile: Referee }) {
  return (
    <section className="mx-panel">
      <h2>GrassKickz match history</h2>
      <small>Accepted appointments on completed public fixtures</small>
      {!r.match_history?.length ? (
        <p className="mx-muted" style={{ marginTop: 15 }}>
          Completed assignments will appear here automatically.
        </p>
      ) : (
        r.match_history.map((h) => (
          <div className="mx-row" key={h.id}>
            <div>
              <Link to={`/match-exchange/${h.id}`}>
                <strong>{h.title}</strong>
              </Link>
              <p>
                {h.club_name} · {h.opponent_name}
              </p>
              <small>
                {when(h.starts_at)} · {h.timezone}
              </small>
            </div>
            <Status value={h.volunteer ? "VOLUNTEER" : h.duty} />
          </div>
        ))
      )}
    </section>
  );
}

