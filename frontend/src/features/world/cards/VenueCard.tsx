import { Link } from 'react-router-dom';
import { LandPlot } from 'lucide-react';
import { Badge, ButtonLink } from '../../../design/primitives';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formats, surfaces, type Venue } from '../../venues/api';
import { fromPrice, money } from '../../venues/utils';
import { plural, useWorldCopy } from '../copy';
import { counterpartProps, useMapCounterpart } from '../directory/selection';
import './cards.css';

/** A compact venue card: photo, place, pitches and the starting hourly rate. */
export function VenueCard({ venue, date, duration }: { venue: Venue; date?: string; duration?: string }) {
    const t = useWorldCopy();
    const counterpart = useMapCounterpart();
    const active = venue.pitches.filter(pitch => pitch.active);
    const formatNames = [...new Set(active.map(pitch => t(formats[pitch.format])))].slice(0, 3);
    const surfaceNames = [...new Set(active.map(pitch => t(surfaces[pitch.surface])))].slice(0, 2);
    const price = fromPrice(venue);
    const query = date ? `?date=${date}&duration=${duration || 60}` : '';
    const photo = venue.photos[0];
    return (
        <article className="gk-world-card gk-world-venue" {...counterpartProps(counterpart)}>
            <Link className="gk-world-venue__photo" to={`/stadiums/${venue.id}${query}`} tabIndex={-1} aria-hidden="true">
                {photo ? <MediaImage src={resolveMediaUrl(photo.url)} alt="" loading="lazy" /> : <LandPlot />}
            </Link>
            <div className="gk-world-card__title">
                <h3><Link to={`/stadiums/${venue.id}${query}`} title={venue.displayName}>{venue.displayName}</Link></h3>
                <p>{venue.addressText || venue.city}</p>
            </div>
            <div className="gk-world-card__facts">
                <Badge tone={venue.bookingMode === 'INSTANT' ? 'accent' : 'neutral'}>{venue.bookingMode === 'INSTANT' ? t('Instant confirmation') : t('Request to book')}</Badge>
                <span>{active.length ? plural(active.length, 'pitch', 'pitches') : t('No bookable pitches')}</span>
                {active.some(pitch => pitch.covered) && <span>{t('Covered')}</span>}
                {venue.displayName.endsWith(' · Demo') && <Badge>{t('Demo venue')}</Badge>}
            </div>
            {(formatNames.length > 0 || surfaceNames.length > 0) && <p className="gk-world-card__desc gk-world-card__desc--one">{[...formatNames, ...surfaceNames].join(' · ')}</p>}
            <div className="gk-world-card__actions">
                <span className="gk-world-venue__price">{price === null ? t('Rates not published') : <><strong className="gk-num">{money(price, venue.currency)}</strong> / {t('hour')}</>}</span>
                <ButtonLink size="sm" variant="secondary" to={`/stadiums/${venue.id}${query}`}>{date ? t('See times') : t('Open')}</ButtonLink>
            </div>
        </article>
    );
}
