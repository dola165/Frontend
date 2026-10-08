import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { DiscoverySectionTabs } from "../components/discovery/DiscoverySectionTabs";
import { MediaImage } from "../components/ui/MediaImage";
import { extractApiErrorMessage } from "../utils/apiError";
import { resolveMediaUrl } from "../utils/resolveMediaUrl";
import {
  fetchVenues,
  formats,
  surfaces,
  type Venue,
} from "../features/venues/api";
import { VenueMap } from "../features/venues/VenueMap";
import { MyVenueBookings } from "../features/venues/VenueBookings";
import { fromPrice, money, today } from "../features/venues/utils";
import "../features/venues/venues.css";

export function StadiumsPage() {
  const [params, setParams] = useSearchParams(),
    [venues, setVenues] = useState<Venue[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [map, setMap] = useState(false),
    [selected, setSelected] = useState<number>();
  const query = params.toString(),
    mine = params.get("tab") === "bookings",
    page = Math.max(0, Number(params.get("page")) || 0);
  useEffect(() => {
    if (mine) return;
    const controller = new AbortController(),
      search = new URLSearchParams(query);
    // A filter change starts a distinct search; never show old results as current.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    setSelected(undefined);
    void fetchVenues(
      {
        q: search.get("q") || undefined,
        city: search.get("city") || undefined,
        format: search.get("format") || undefined,
        surface: search.get("surface") || undefined,
        covered: search.get("covered") === "true" ? true : undefined,
        minPrice: search.get("minPrice") ? Number(search.get("minPrice")) : undefined,
        maxPrice: search.get("maxPrice")
          ? Number(search.get("maxPrice"))
          : undefined,
        currency: (search.get("maxPrice") || search.get("minPrice"))
          ? search.get("currency") || "GEL"
          : undefined,
        date: search.get("date") || undefined,
        durationMinutes: Number(search.get("durationMinutes")) || 60,
        page: Math.max(0, Number(search.get("page")) || 0),
        size: 12,
      },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setVenues(data.content);
          setTotal(data.totalElements);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            extractApiErrorMessage(
              err,
              "Stadiums could not load. Please try again.",
            ),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, mine, reload]);
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget),
      next = new URLSearchParams();
    for (const [key, value] of values)
      if (typeof value === "string" && value.trim())
        next.set(key, value.trim());
    setParams(next);
  };
  return (
    <main className="venue-page venue-directory">
      <DiscoverySectionTabs />
      <header className="venue-directory-heading">
        <div><p className="venue-eyebrow">MORE FOOTBALL. LESS ORGANISING.</p><h1>Stadiums</h1><p>Find your next pitch. Compare rates and choose a time to play.</p></div>
        <Link className="venue-button" to="/organizations/create?kind=VENUE">List your stadium <ArrowUpRight size={17} /></Link>
      </header>
      <div className="venue-section-tabs">
        <button
          aria-pressed={!mine}
          className={!mine ? "is-active" : ""}
          onClick={() =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("tab");
              return next;
            })
          }
        >
          <MapPin size={17} />
          Find a stadium
        </button>
        <button
          aria-pressed={mine}
          className={mine ? "is-active" : ""}
          onClick={() => setParams({ tab: "bookings" })}
        >
          <CalendarDays size={17} />
          My reservations
        </button>
      </div>
      {mine ? (
        <MyVenueBookings />
      ) : (
        <>
          <div className="venue-directory-search" key={`search-${query}`}>
              <label className="venue-field">
                <span className="sr-only">Search stadiums</span>
                <div className="venue-input-icon">
                  <Search size={17} />
                  <input
                    name="q" form="venue-filters"
                    defaultValue={params.get("q") || ""}
                    placeholder="Stadium name or area"
                    maxLength={100}
                  />
                </div>
              </label>
            <span>Pay at the venue · Rates per hour</span>
          </div>
          <div className="venue-directory-body">
          <form id="venue-filters" className="venue-search-panel" onSubmit={search} key={query}>
            <div className="venue-filter-heading"><strong><SlidersHorizontal size={15} /> Filter stadiums</strong><button type="button" className="venue-link" onClick={() => setParams({})}>Reset</button></div>
            <div className="venue-search-main">
              <label className="venue-field">
                <span>City</span>
                <input
                  name="city"
                  placeholder="All cities"
                  defaultValue={params.get("city") || ""}
                  maxLength={100}
                />
              </label>
              <label className="venue-field">
                <span>Date</span>
                <input
                  aria-label="Date with availability"
                  type="date"
                  name="date"
                  min={today()}
                  defaultValue={params.get("date") || ""}
                />
              </label>
              <label className="venue-field">
                <span>Duration</span>
                <select
                  name="durationMinutes"
                  defaultValue={params.get("durationMinutes") || "60"}
                >
                  <option value="60">1 hour</option>
                  <option value="90">1½ hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3 hours</option>
                </select>
              </label>

            </div>
            <div
              id="venue-extra-filters"
              className="venue-extra-filters is-open"
            >
              <label className="venue-field">
                <span>Football format</span>
                <select name="format" defaultValue={params.get("format") || ""}>
                  <option value="">Any format</option>
                  {Object.entries(formats).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="venue-field">
                <span>Surface</span>
                <select
                  name="surface"
                  defaultValue={params.get("surface") || ""}
                >
                  <option value="">Any surface</option>
                  {Object.entries(surfaces).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="venue-field"><span>Minimum hourly price</span><input type="number" name="minPrice" min="0" step="1" placeholder="From" defaultValue={params.get("minPrice") || ""} /></label>
              <label className="venue-field">
                <span>Maximum hourly price</span>
                <input
                  type="number"
                  name="maxPrice"
                  min="0"
                  step="1"
                  placeholder="Any price"
                  defaultValue={params.get("maxPrice") || ""}
                />
              </label>
              <label className="venue-field">
                <span>Price currency</span>
                <select
                  name="currency"
                  defaultValue={params.get("currency") || "GEL"}
                >
                  {["GEL", "USD", "EUR", "GBP"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="venue-checkbox">
                <input
                  type="checkbox"
                  name="covered"
                  value="true"
                  defaultChecked={params.get("covered") === "true"}
                />
                Covered pitches
              </label>

            </div>
            <button type="submit" className="venue-button venue-button--primary">Find a pitch <Search size={16} /></button>
          </form>
          <div className="venue-directory-results">
          <div className="venue-results-heading">
            <div>
              <h2>Find a pitch</h2>
              <p role="status">
                {loading
                  ? "Finding your next pitch…"
                  : `${total} ${total === 1 ? "stadium" : "stadiums"}${params.get("date") ? " with availability on your date" : " to discover"}`}
              </p>
            </div>
            <div className="venue-view-toggle" aria-label="Results layout">
              <button
                className={!map ? "is-active" : ""}
                aria-pressed={!map}
                onClick={() => setMap(false)}
              >
                <List size={16} />
                List
              </button>
              <button
                className={map ? "is-active" : ""}
                aria-pressed={map}
                onClick={() => setMap(true)}
              >
                <MapIcon size={16} />
                Map
              </button>
            </div>
          </div>
          {error ? (
            <div role="alert" className="venue-empty">
              <h2>We couldn’t load stadiums</h2>
              <p>{error}</p>
              <button
                className="venue-button"
                onClick={() => setReload((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : (
            <div
              className={`venue-discovery-layout ${map ? "with-map" : ""}`}
              aria-busy={loading}
            >
              <section className="venue-card-grid" aria-label="Stadiums">
                {loading ? (
                  [1, 2, 3, 4].map((value) => (
                    <div className="venue-card venue-skeleton" key={value}>
                      <div />
                      <span />
                      <span />
                    </div>
                  ))
                ) : !venues.length ? (
                  <div className="venue-empty">
                    <Warehouse size={38} />
                    <h2>
                      {query
                        ? "No stadiums match this search"
                        : "A new home for local football"}
                    </h2>
                    <p>
                      {query
                        ? "Try another date, city or pitch preference."
                        : "Stadium owners can now create a page and open their calendar for bookings."}
                    </p>
                    {query ? (
                      <button
                        className="venue-button"
                        onClick={() => setParams({})}
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Link
                        className="venue-button venue-button--primary"
                        to="/organizations/create?kind=VENUE"
                      >
                        List your stadium
                      </Link>
                    )}
                  </div>
                ) : (
                  venues.map((venue) => (
                    <article
                      key={venue.id}
                      className={`venue-card ${selected === venue.id ? "is-selected" : ""}`}
                      onMouseEnter={() => setSelected(venue.id)}
                    >
                      <Link
                        to={`/stadiums/${venue.id}${params.get("date") ? `?date=${params.get("date")}&duration=${params.get("durationMinutes") || 60}` : ""}`}
                        className="venue-card-photo"
                      >
                        {venue.photos[0] ? (
                          <MediaImage
                            src={resolveMediaUrl(venue.photos[0].url)}
                            alt={venue.photos[0].caption || venue.displayName}
                            loading="lazy"
                          />
                        ) : (
                          <div className="venue-photo-placeholder">
                            <Warehouse size={38} />
                            <span>Photos coming soon</span>
                          </div>
                        )}
                        <span className="venue-photo-badge">
                          {venue.bookingMode === "INSTANT"
                            ? "Instant confirmation"
                            : "Request to book"}
                        </span>
                      </Link>
                      <div className="venue-card-body">
                        {venue.displayName.endsWith(" · Demo") && <p className="venue-demo-label">Demo venue · Example photography</p>}
                        <p className="venue-card-location">
                          <MapPin size={13} />
                          {venue.city || venue.addressText}
                        </p>
                        <Link to={`/stadiums/${venue.id}`}>
                          <h3>{venue.displayName}</h3>
                        </Link>
                        <div className="venue-tags">
                          {[
                            ...new Set(
                              venue.pitches
                                .filter((pitch) => pitch.active)
                                .map((pitch) => formats[pitch.format]),
                            ),
                          ]
                            .slice(0, 3)
                            .map((format) => (
                              <span key={format}>{format}</span>
                            ))}
                          {venue.pitches.some(
                            (pitch) => pitch.active && pitch.covered,
                          ) && <span>Covered</span>}
                        </div>
                        <div className="venue-card-footer">
                          <p>
                            {fromPrice(venue) === null ? (
                              "Rates coming soon"
                            ) : (
                              <>
                                From{" "}
                                <strong>
                                  {money(fromPrice(venue)!, venue.currency)}
                                </strong>
                                <span> / hour</span>
                              </>
                            )}
                          </p>
                          <Link
                            to={`/stadiums/${venue.id}`}
                            aria-label={`See ${venue.displayName} availability`}
                          >
                            <ArrowUpRight size={21} />
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
              {map && (
                <aside className="venue-discovery-map">
                  <VenueMap
                    venues={loading ? [] : venues}
                    selectedId={selected}
                    onSelect={setSelected}
                  />
                </aside>
              )}
            </div>
          )}
          {!loading && total > 12 && (
            <nav className="venue-pagination" aria-label="Stadium pages">
              <button
                className="venue-button"
                disabled={page === 0}
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("page", String(page - 1));
                    return next;
                  })
                }
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {Math.ceil(total / 12)}
              </span>
              <button
                className="venue-button"
                disabled={(page + 1) * 12 >= total}
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("page", String(page + 1));
                    return next;
                  })
                }
              >
                Next
              </button>
            </nav>
          )}
          </div>
          </div>
        </>
      )}
    </main>
  );
}
