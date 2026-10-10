import { Link } from 'react-router-dom';
import { LandPlot } from 'lucide-react';
import { Badge, ButtonLink } from '../../../design/primitives';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formats, surfaces, type Venue } from '../../venues/api';
import { fromPrice, money } from '../../venues/utils';
import './cards.css';

/** A compact venue card: photo, place, pitches and the starting hourly rate. */
export function VenueCard({ venue, date, duration }: { venue: Venue; date?: string; duration?: string }) {
    const active = venue.pitches.filter(pitch => pitch.active);
    const formatNames = [...new Set(active.map(pitch => formats[pitch.format]))].slice(0, 3);
    const surfaceNames = [...new Set(active.map(pitch => surfaces[pitch.surface]))].slice(0, 2);
    const price = fromPrice(venue);
    const query = date ? `?date=${date}&duration=${duration || 60}` : '';
    const photo = venue.photos[0];
    return (
        <article className="gk-world-card gk-world-venue">
            <Link className="gk-world-venue__photo" to={`/stadiums/${venue.id}${query}`} tabIndex={-1} aria-hidden="true">
                {photo ? <MediaImage src={resolveMediaUrl(photo.url)} alt="" loading="lazy" /> : <LandPlot />}
            </Link>
            <div className="gk-world-card__title">
                <h3><Link to={`/stadiums/${venue.id}${query}`}>{venue.displayName}</Link></h3>
                <p>{venue.addressText || venue.city}</p>
            </div>
            <div className="gk-world-card__facts">
                <Badge tone={venue.bookingMode === 'INSTANT' ? 'accent' : 'neutral'}>{venue.bookingMode === 'INSTANT' ? 'Instant confirmation' : 'Request to book'}</Badge>
                <span>{active.length ? `${active.length} ${active.length === 1 ? 'pitch' : 'pitches'}` : 'No bookable pitches'}</span>
                {active.some(pitch => pitch.covered) && <span>Covered</span>}
                {venue.displayName.endsWith(' · Demo') && <Badge>Demo venue</Badge>}
            </div>
            {(formatNames.length > 0 || surfaceNames.length > 0) && <p className="gk-world-card__desc gk-world-card__desc--one">{[...formatNames, ...surfaceNames].join(' · ')}</p>}
            <div className="gk-world-card__actions">
                <span className="gk-world-venue__price">{price === null ? 'Rates not published' : <><strong className="gk-num">{money(price, venue.currency)}</strong> / hour</>}</span>
                <ButtonLink size="sm" variant="secondary" to={`/stadiums/${venue.id}${query}`}>{date ? 'See times' : 'Open'}</ButtonLink>
            </div>
        </article>
    );
}
