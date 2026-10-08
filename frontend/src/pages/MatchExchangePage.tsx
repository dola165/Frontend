import { useAuth } from '../context/AuthContext';
import { hasNavigationCapability } from '../context/navigationCapabilities';
import { useClock, useLoad } from "../features/matchExchange/hooks";
import { SelectionIndicator } from '../components/ui/SelectionIndicator';
import { useState, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  SlidersHorizontal,
  MapPin,
  Plus,
  Search,
  Zap,
  Flag,
} from "lucide-react";
import {
  ages,
  formats,
  levels,
  label,
  type Match,
  type Referee,
  type Squad,
} from "../features/matchExchange/api";
import { LoadState, Status } from "../features/matchExchange/shared";
import { ListingEditor } from "../features/matchExchange/ListingEditor";
import { MediaImage } from "../components/ui/MediaImage";
import { resolveMediaUrl } from "../utils/resolveMediaUrl";
import { journeyLabel, matchSchedule, useJourneyCopy } from "../features/matchExchange/journeyCopy";
import { MatchHistoryLink } from "../features/matchHistory/MatchHistoryLink";
import { ResultSummary } from "../features/matchHistory/ResultSummary";
import '../features/matchHistory/match-history.css';
const MatchMap = lazy(() => import("../features/matchExchange/MatchMap"));
export function MatchExchangePage({ embedded = false, officials = false }: { embedded?: boolean; officials?: boolean } = {}) {
  const { user } = useAuth();
  const [failedClubLogos, setFailedClubLogos] = useState<Set<string>>(() => new Set());
  const refereeWorkspace = hasNavigationCapability(user?.navigationCapabilities, 'referee.workspace');
  const now = useClock();
  const { copy, language } = useJourneyCopy();
  const [params, setParams] = useSearchParams(),
    [creating, setCreating] = useState(false),
    [map, setMap] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [locationError, setLocationError] = useState("");
  const tab = params.get("tab") || "browse",
    referees = officials || tab === "referees",
    page = Number(params.get("page")) || 0;
  const filterKeys = referees
    ? ["format", "volunteer"]
    : ["format", "ageGroup", "level", "from", "to", "venuePreference", "lat"];
  const activeFilters = filterKeys.filter((key) => params.has(key)).length;
  const query = new URLSearchParams();
  for (const key of [...filterKeys, "q", "page", "lng", "radiusKm"]) if (params.has(key)) query.set(key, params.get(key)!);
  query.delete("tab");
  if (tab === "mine") query.set("mine", "true");

  const { data, error, reload } = useLoad<{
      items: Match[] | Referee[];
      total: number;
    }>(`${referees ? "/referees" : "/match-exchange"}?${query}`),
    { data: squads } = useLoad<Squad[]>("/match-exchange/squads");
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ["format", "volunteer", "ageGroup", "level", "from", "to", "venuePreference", "lat", "lng", "radiusKm", "page"]) {
      next.delete(key);
    }
    setParams(next);
  }
  function nearby() {
    if (!navigator.geolocation) {
      setLocationError("Location is unavailable. Search by city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = new URLSearchParams(params);
        next.set("lat", String(p.coords.latitude));
        next.set("lng", String(p.coords.longitude));
        next.set("radiusKm", "50");
        next.delete("page");
        setParams(next);
        setLocationError("");
      },
      () =>
        setLocationError(
          "Location access was not available. You can still search by city.",
        ),
    );
  }
  const Container = embedded ? 'section' : 'main';
  return (
    <Container className="mx-page mx-exchange">
      <header className="mx-head mx-exchange-head">
        <div>
          {embedded ? <h2>{referees ? <Flag size={22} aria-hidden="true"/> : <Zap size={22} aria-hidden="true"/>}{language.startsWith('ka') ? referees ? 'მსაჯები' : tab === 'mine' ? 'ჩემი შეთანხმებები' : 'მატჩების გაცვლა' : referees ? 'Officials' : tab === 'mine' ? 'My arrangements' : 'Match exchange'}</h2> : <h1>{copy("exchange")}</h1>}
          <p className="mx-muted">{referees ? language.startsWith('ka') ? 'იპოვეთ მსაჯი და მართეთ თქვენი დანიშვნები.' : 'Find a referee for your next match and keep track of your appointments.' : copy("exchangeIntro")}</p>
        </div>
        <div className="mx-actions">
          {refereeWorkspace && <Link className="mx-button" to="/referees/me">
            {copy("refereeWorkspace")}
          </Link>}
          {!referees && !!squads?.length && (
            <button
              className="mx-primary"
              onClick={() => setCreating((v) => !v)}
            >
              <Plus size={16} /> {language.startsWith('ka')?'მატჩის დაგეგმვა':'Arrange a match'}
            </button>
          )}
        </div>
      </header>
      {!embedded && <nav className="app-selection-rail mx-tabs" aria-label="Match Exchange">
        <SelectionIndicator value={referees ? 'referees' : tab} />
        <MatchHistoryLink />
        <Link
          to="/match-exchange"
          aria-current={tab === "browse" ? "page" : undefined}
        >
          {copy("findMatch")}
        </Link>
        <Link
          to="/match-exchange?tab=mine"
          aria-current={tab === "mine" ? "page" : undefined}
        >
          {copy("arrangements")}
        </Link>
        <Link
          to="/match-exchange?tab=referees"
          aria-current={referees ? "page" : undefined}
        >
          {copy("findReferee")}
        </Link>
        {refereeWorkspace && <Link to="/referees/me#open-requests">Referee opportunities</Link>}
      </nav>}
      {creating ? (
        <ListingEditor
          onClose={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : (
        <>
          
          <div className="mx-search-toolbar">
            <label className="mx-search-field">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search Match Exchange"
                placeholder={referees ? "Search referees, areas or languages" : "Search clubs, places or matches"}
                value={params.get("q") || ""}
                onChange={(e) => filter("q", e.target.value)}
              />
            </label>
            <button type="button" className="mx-filter-toggle" aria-expanded={filtersOpen} aria-controls="mx-filter-options" onClick={() => setFiltersOpen((open) => !open)}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}
              <ChevronDown size={15} className={filtersOpen ? "mx-chevron-open" : ""} aria-hidden="true" />
            </button>
          </div>
          {filtersOpen && <form id="mx-filter-options" className="mx-filters" onSubmit={(e) => e.preventDefault()}>
            <label>
              Format
              <select
                value={params.get("format") || ""}
                onChange={(e) => filter("format", e.target.value)}
              >
                <option value="">All formats</option>
                {Object.entries(formats).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {referees ? (
              <label className="mx-check">
                <input
                  type="checkbox"
                  checked={params.get("volunteer") === "true"}
                  onChange={(e) =>
                    filter("volunteer", e.target.checked ? "true" : "")
                  }
                />{" "}
                Open to volunteering
              </label>
            ) : (
              <>
                <label>
                  Age group
                  <select
                    value={params.get("ageGroup") || ""}
                    onChange={(e) => filter("ageGroup", e.target.value)}
                  >
                    <option value="">All age groups</option>
                    {ages.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Level
                  <select
                    value={params.get("level") || ""}
                    onChange={(e) => filter("level", e.target.value)}
                  >
                    <option value="">All levels</option>
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {label(l)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="date"
                    value={params.get("from") || ""}
                    onChange={(e) => filter("from", e.target.value)}
                  />
                </label>
                <label>
                  Until
                  <input
                    type="date"
                    value={params.get("to") || ""}
                    onChange={(e) => filter("to", e.target.value)}
                  />
                </label>
                <label>
                  Home / away
                  <select
                    value={params.get("venuePreference") || ""}
                    onChange={(e) => filter("venuePreference", e.target.value)}
                  >
                    <option value="">Either</option>
                    <option value="HOME">They host</option>
                    <option value="AWAY">They travel</option>
                  </select>
                </label>
                <div className="mx-actions">
                  <button type="button" onClick={nearby}>
                    <MapPin size={16} /> Near me
                  </button>
                  {params.has("lat") && (
                    <button
                      type="button"
                      onClick={() => {
                        const n = new URLSearchParams(params);
                        ["lat", "lng", "radiusKm"].forEach((k) => n.delete(k));
                        setParams(n);
                      }}
                    >
                      Clear distance
                    </button>
                  )}
                </div>
              </>
            )}
            {activeFilters > 0 && <button type="button" className="mx-clear-filters" onClick={clearFilters}>Clear filters</button>}
          </form>}
          {locationError && (
            <p role="status" className="mx-notice">
              {locationError}
            </p>
          )}
          <div className="mx-head mx-results-head">
            <h2>
              {data
                ? `${data.total} ${referees ? "referees" : tab === "mine" ? "arrangements" : "matches"}`
                : "Searching…"}
            </h2>
            {!referees && (
              <button aria-pressed={map} onClick={() => setMap(!map)}>
                <MapPin size={16} />
                {map ? "Hide map" : "Show map"}
              </button>
            )}
          </div>
          {error ? (
            <LoadState error={error} reload={reload} />
          ) : !data ? (
            <LoadState error="" reload={reload} />
          ) : (
            <>
              {map && !referees && (
                <Suspense fallback={<p>Loading map…</p>}>
                  <MatchMap matches={data.items as Match[]} />
                </Suspense>
              )}
              {data.items.length === 0 ? (
                <section className="mx-panel mx-empty">
                  <Search size={28} style={{ margin: "0 auto 14px" }} />
                  <h2>
                    {tab === "mine"
                      ? "No match arrangements yet"
                      : "No results for these filters"}
                  </h2>
                  <p>
                    {tab === "mine"
                      ? "Create a listing or send a proposal from your squad."
                      : "Try another date, city or format."}
                  </p>
                </section>
              ) : (
                <div className={referees ? "mx-grid" : "mx-listing-grid"}>
                  {referees
                    ? (data.items as Referee[]).map((r) => (
                        <article className="mx-card" key={r.user_id}>
                          <div className="mx-identity">
                            <span className="mx-avatar">
                              {r.full_name
                                .split(" ")
                                .map((v) => v[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <div>
                              <h3>
                                <Link to={`/referees/${r.user_id}`}>
                                  {r.full_name}
                                </Link>
                              </h3>
                              <p className="mx-muted">
                                {r.service_area} · up to {r.travel_km} km
                              </p>
                            </div>
                          </div>
                          <p>{r.biography.slice(0, 180)}</p>
                          <div className="mx-facts">
                            <span>{r.languages}</span>
                            <span>
                              {r.accepts_volunteer
                                ? "Open to volunteering"
                                : ""}
                            </span>
                          </div>
                          <footer className="mx-card-footer">
                            <span>
                              {r.accepts_paid
                                ? `From ${r.fee} ${r.currency} / match`
                                : "Volunteer appointments"}
                            </span>
                            <Link to={`/referees/${r.user_id}`}>
                              View profile{" "}
                              <ArrowUpRight size={14} className="inline" />
                            </Link>
                          </footer>
                        </article>
                      ))
                    : (data.items as Match[]).map((m) => {
                        const schedule = matchSchedule(m.starts_at_iso, m.ends_at_iso, m.timezone, language);
                        const clubLogo = resolveMediaUrl(m.club_logo_url);
                        return <article className="mx-listing" key={m.event_id}>
                          <div className="mx-listing-brand">
                            <Link to={`/clubs/${m.club_id}`} className="mx-listing-club">
                              <span className="mx-listing-crest">
                                {clubLogo && !failedClubLogos.has(clubLogo) ? <MediaImage src={clubLogo} alt="" loading="lazy" onError={() => setFailedClubLogos(previous => new Set(previous).add(clubLogo))} />
                                  : m.club_name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}
                              </span>
                              <span className="mx-listing-club-copy"><strong>{m.club_name}</strong><small>{m.squad_name}</small></span>
                            </Link>
                            <Status value={m.listing_status} />
                          </div>
                          <h3><Link to={`/match-exchange/${m.event_id}`}>{m.title}</Link></h3>
                          {(m.result_status || new Date(m.ends_at_iso).getTime() <= now || m.event_status === 'CANCELLED') && <ResultSummary homeScore={m.home_score} awayScore={m.away_score} status={m.result_status} legacy={m.result_legacy} fixtureStatus={m.event_status} ended={new Date(m.ends_at_iso).getTime() <= now} compact />}
                          <div className="mx-listing-schedule">
                            <CalendarDays size={18} aria-hidden="true" />
                            <div><strong>{schedule.date}</strong><span>{schedule.time} <small>· {m.timezone}</small></span></div>
                          </div>
                          <p className="mx-listing-location"><MapPin size={16} aria-hidden="true" /><span>{m.location_name ? `${m.location_name}, ${m.city}` : m.city}</span></p>
                          <div className="mx-listing-tags">
                            <span>{m.age_group} · {formats[m.format] || label(m.format)}</span>
                            <span>{copy(m.venue_preference === "HOME" ? "theyHost" : m.venue_preference === "AWAY" ? "theyTravel" : "eitherVenue")}</span>
                          </div>
                          <div className="mx-listing-readiness" aria-label={copy("readiness")}>
                            <span>{copy("pitch")}: <strong>{journeyLabel(m.venue_status, language)}</strong></span>
                            <span>{copy("official")}: <strong>{journeyLabel(m.referee_status, language)}</strong></span>
                          </div>
                          <footer className="mx-listing-footer">
                            <span>{journeyLabel(m.level, language)}</span>
                            <Link to={`/match-exchange/${m.event_id}`}>{copy(tab === "mine" ? "reviewArrangement" : "viewMatch")} <ArrowUpRight size={16} aria-hidden="true" /></Link>
                          </footer>
                        </article>;
                      })}
                </div>
              )}
              <div className="mx-pagination">
                <button
                  disabled={page === 0}
                  onClick={() => {
                    const n = new URLSearchParams(params);
                    n.set("page", String(page - 1));
                    setParams(n);
                  }}
                >
                  Previous
                </button>
                <span className="mx-muted">Page {page + 1}</span>
                <button
                  disabled={(page + 1) * 24 >= data.total}
                  onClick={() => {
                    const n = new URLSearchParams(params);
                    n.set("page", String(page + 1));
                    setParams(n);
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Container>
  );
}
