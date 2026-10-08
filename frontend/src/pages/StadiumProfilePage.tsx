import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { venueContentPolicyCopy } from "../features/venues/contentPolicyCopy";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Settings2,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MediaImage } from "../components/ui/MediaImage";
import { resolveMediaUrl } from "../utils/resolveMediaUrl";
import { extractApiErrorMessage } from "../utils/apiError";
import {
  fetchVenue,
  formats,
  surfaces,
  type Venue,
} from "../features/venues/api";
import { VenueMap } from "../features/venues/VenueMap";
import { VenueCalendar } from "../features/venues/VenueCalendar";
import { VenueOrganizations } from "../features/venues/VenueOrganizations";
import { venueMapLink } from "../features/venues/venueMapLink";
import { canBookVenue, fromPrice, money, safeWebsite } from "../features/venues/utils";
import "../features/venues/venues.css";

export function StadiumProfilePage() {
  const { organizationId } = useParams(),
    { sessionId } = useAuth();
  if (!organizationId || !/^\d+$/.test(organizationId))
    return (
      <main className="venue-page venue-empty">
        <h1>Stadium not found</h1>
        <Link to="/stadiums">Explore stadiums</Link>
      </main>
    );
  return (
    <StadiumProfile
      key={`${organizationId}-${sessionId}`}
      id={Number(organizationId)}
    />
  );
}
function StadiumProfile({ id }: { id: number }) {
  const { hash } = useLocation();
  const { i18n } = useTranslation(), policy = venueContentPolicyCopy(i18n.language);
  const [params] = useSearchParams();
  const booking = params.get("book") === "1";
  useEffect(() => { window.scrollTo(0, 0); }, [booking]);
  const [venue, setVenue] = useState<Venue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [photo, setPhoto] = useState(0);
  useEffect(() => {
    if (venue && !booking && /^#pitch-\d+$/.test(hash)) document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'center' });
  }, [venue, booking, hash]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchVenue(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setVenue(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(extractApiErrorMessage(err, "This stadium is unavailable."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry]);
  if (loading)
    return (
      <main className="venue-page venue-empty" role="status">
        Loading stadium…
      </main>
    );
  if (!venue)
    return (
      <main className="venue-page venue-empty">
        <h1>Stadium unavailable</h1>
        <p role="alert">{error}</p>
        <button
          className="venue-button"
          onClick={() => {
            setLoading(true);
            setRetry((n) => n + 1);
          }}
        >
          Try again
        </button>
        <Link to="/stadiums">Explore stadiums</Link>
      </main>
    );
  if (venue.promotionBlocked) return (
    <main className="venue-page venue-empty">
      <h1>{policy.blocked}</h1>
      <p role="status">{policy.notice}</p>
      {venue.canManage && <Link className="venue-button venue-button--primary" to={`/stadiums/${venue.id}/manage`}>{policy.workspace}</Link>}
      <Link to="/stadiums">{policy.explore}</Link>
    </main>
  );
  const bookable = canBookVenue(venue);
  const price = fromPrice(venue),
    website = safeWebsite(venue.website);
  const bookingParams = new URLSearchParams(params);
  bookingParams.set("book", "1");
  const profileParams = new URLSearchParams(params);
  profileParams.delete("book");
  if (booking) return <main className="venue-page venue-booking-page">
    <div className="venue-breadcrumb"><Link to={`/stadiums/${venue.id}?${profileParams}`}><ArrowLeft size={15}/>Back to stadium</Link></div>
    <header className="venue-booking-identity">
      {venue.photos[0] && <MediaImage src={resolveMediaUrl(venue.photos[0].url)} alt=""/>}
      <div><p className="venue-eyebrow">Book your pitch</p><h1>{venue.logoUrl && <MediaImage src={resolveMediaUrl(venue.logoUrl)} alt="" className="mr-3 inline-block h-16 w-16 rounded-xl object-contain"/>}{venue.displayName}</h1><p><MapPin size={14}/>{venue.addressText}</p></div>
    </header>
    <VenueOrganizations venue={venue} />
    {bookable ? <VenueCalendar key={venue.id} venue={venue}/> : <p role="status" className="venue-panel">This venue is not accepting online rental bookings. Contact the venue or your club about arranged sessions.</p>}
  </main>;
  return (
    <main className="venue-page venue-profile">
      <div className="venue-breadcrumb">
        <Link to="/stadiums">
          <ArrowLeft size={15} />
          Stadiums
        </Link>
        <ChevronRight size={13} />
        <span>{venue.displayName}</span>
        {venue.canManage && (
          <Link className="venue-button" to={`/stadiums/${venue.id}/manage`}>
            <Settings2 size={15} />
            Manage stadium
          </Link>
        )}
      </div>
      {!venue.published && (
        <div className="venue-notice">
          <strong>Private preview · Not published yet.</strong> This is how your venue page will look to visitors. Add photos, pitches, opening hours and contact details, then publish it from your workspace.
          {venue.capabilities?.canConfigureVenue && <Link className="venue-link" to={`/stadiums/${venue.id}/manage?view=listing`}> Continue setting up your venue →</Link>}
        </div>
      )}
      <section className="venue-gallery" aria-label="Stadium photos">
        <div className="venue-gallery-main">
          {venue.photos[photo] ? (
            <MediaImage
              src={resolveMediaUrl(venue.photos[photo].url)}
              alt={venue.photos[photo].caption || venue.displayName}
            />
          ) : (
            <div className="venue-photo-placeholder">
              <Warehouse size={60} />
              <span>The next game starts here</span>
            </div>
          )}
          <div className="venue-gallery-overlay">
            <span className="venue-photo-badge">
              <MapPin size={13} />
              {venue.city || "Football venue"}
            </span>
            <h1>{venue.logoUrl && <MediaImage src={resolveMediaUrl(venue.logoUrl)} alt="" className="mr-3 inline-block h-16 w-16 rounded-xl object-contain"/>}{venue.displayName}</h1>
            <p>{venue.addressText}</p>
          </div>
          {venue.photos.length > 1 && (
            <span className="venue-photo-count">
              {photo + 1} / {venue.photos.length}
            </span>
          )}
        </div>
        {venue.photos.length > 1 && (
          <div className="venue-gallery-thumbs">
            {venue.photos.map((value, index) => (
              <button
                key={`${value.url}-${index}`}
                aria-label={`Show photo ${index + 1}: ${value.caption || venue.displayName}`}
                aria-pressed={index === photo}
                onClick={() => setPhoto(index)}
              >
                <MediaImage
                  src={resolveMediaUrl(value.url)}
                  alt={value.caption || `Stadium view ${index + 1}`}
                />
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="venue-profile-intro">
        <div className="venue-tags">
          <span>
            <Warehouse size={14} />
            {venue.pitches.filter((pitch) => pitch.active).length}
            pitches
          </span>
          <span>
            {bookable ? venue.bookingMode === "INSTANT"
              ? "Instant confirmation"
              : "Owner confirms requests" : "Online rentals unavailable"}
          </span>
          {bookable && <span>Pay at venue</span>}
        </div>
        {bookable && <Link to={`/stadiums/${venue.id}?${bookingParams}`} className="venue-button venue-button--primary">
          {price !== null ? (
            <>From {money(price, venue.currency)} / hour · </>
          ) : (
            ""
          )}
          See free times
          <ArrowUpRight size={17} />
        </Link>}
      </div>
      <VenueOrganizations venue={venue} />
      <div className="venue-profile-details">
        <section className="venue-about">
          <p className="venue-eyebrow">A place to play</p>
          <h2>About the stadium</h2>
          <p className="venue-description">
            {venue.description ||
              "A place for football matches and training."}
          </p>
          {venue.amenities.length > 0 && (
            <>
              <h3>At the venue</h3>
              <div className="venue-amenities">
                {venue.amenities.map((amenity) => (
                  <span key={amenity}>
                    <Check size={16} />
                    {amenity.replaceAll("_", " ").toLowerCase()}
                  </span>
                ))}
              </div>
            </>
          )}
          <h3>The pitches</h3>
          <div className="venue-pitch-cards">
            {venue.pitches
              .filter((pitch) => pitch.active)
              .map((pitch) => (
                <div key={pitch.id} id={`pitch-${pitch.id}`} className="venue-public-pitch">
                  {pitch.photoUrl ? <MediaImage src={resolveMediaUrl(pitch.photoUrl)} alt={pitch.name} className="venue-public-pitch-photo"/> : <Warehouse size={22} />}
                  <h4>{pitch.name}</h4>
                  <p>
                    {formats[pitch.format]} · {surfaces[pitch.surface]}
                  </p>
                  <p>{pitch.covered ? "Covered" : "Open air"}</p>
                  {bookable && <><strong>
                    {money(pitch.pricePerHour, venue.currency)}{" "}
                    <small>/ hour</small>
                  </strong>
                  <Link className="venue-button" to={`/stadiums/${venue.id}?book=1&pitch=${pitch.id}`}>See times for this pitch<ArrowUpRight size={15}/></Link></>}
                </div>
              ))}
          </div>
        </section>
        <aside className="venue-panel venue-contact">
          <h2>Good to know</h2>
          <p>
            <MapPin size={17} />
            <span>
              {venue.addressText}
              <br />
              {venue.city}
            </span>
          </p>
          {venue.publicPhone && (
            <a href={`tel:${venue.publicPhone}`}>
              <Phone size={17} />
              {venue.publicPhone}
            </a>
          )}
          {venue.publicEmail && (
            <a href={`mailto:${venue.publicEmail}`}>
              <Mail size={17} />
              {venue.publicEmail}
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer">
              Visit website
              <ArrowUpRight size={16} />
            </a>
          )}
          <h3>
            <Clock3 size={16} />
            Opening hours
          </h3>
          {venue.openingHours.length ? (
            <dl className="venue-hours">
              {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => {
                const hours = venue.openingHours.find(
                  (value) => value.dayOfWeek === day,
                );
                return (
                  <div key={day}>
                    <dt>
                      {
                        [
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                          "Sunday",
                        ][day - 1]
                      }
                    </dt>
                    <dd>
                      {hours
                        ? `${hours.opensAt.slice(0, 5)} – ${hours.closesAt.slice(0, 5)}`
                        : "Closed"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p>Contact the venue for opening hours.</p>
          )}
          <small>Times in {venue.timezone}</small>
        </aside>
      </div>

      <section className="venue-location">
        <div className="venue-section-heading">
          <div>
            <p className="venue-eyebrow">Meet you here</p>
            <h2>Find the stadium</h2>
            <p>
              {venue.addressText}
              {venue.city && `, ${venue.city}`}
            </p>
          </div>
          {venue.latitude != null && venue.longitude != null && (
            <Link
              className="venue-button"
              to={venueMapLink(venue.id)}
            >
              Open in GrassKickZ Map
              <MapPin size={16} />
            </Link>
          )}
        </div>
        <VenueMap venues={[venue]} />
      </section>
    </main>
  );
}
