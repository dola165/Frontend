import { LandPlot } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { formats, surfaces, type Venue } from '../../venues/api';
import { fromPrice, money } from '../../venues/utils';
import { plural, useWorldCopy } from '../copy';
import { ResultRow } from '../directory/ResultRow';
import { peekOf } from '../peek/usePeek';
import './cards.css';

/**
 * A venue as one line of a list: a small photo, its name and address, what it has (pitches, formats, surfaces, covered),
 * and at the end its starting hourly rate with how booking works. "See times" when a date is chosen. Pressing it opens
 * the venue beside the list.
 */
export function VenueRow({ venue, date, duration }: { venue: Venue; date?: string; duration?: string }) {
    const t = useWorldCopy();
    const active = venue.pitches.filter(pitch => pitch.active);
    const kinds = [...new Set(active.map(pitch => t(formats[pitch.format])))].slice(0, 3);
    const grounds = [...new Set(active.map(pitch => t(surfaces[pitch.surface])))].slice(0, 2);
    const price = fromPrice(venue);
    const query = date ? `?date=${date}&duration=${duration || 60}` : '';
    const photo = venue.photos[0];
    const has = [active.length ? plural(active.length, 'pitch', 'pitches') : t('No bookable pitches'), ...kinds, ...grounds, active.some(pitch => pitch.covered) ? t('Covered') : null];
    return (
        <ResultRow title={venue.displayName} to={`/stadiums/${venue.id}${query}`} peek={peekOf('venue', venue.id)}
            lead={<span className="gk-world-venue-thumb">{photo ? <MediaImage src={resolveMediaUrl(photo.url)} alt="" loading="lazy" /> : <LandPlot aria-hidden="true" />}</span>}
            lines={[venue.addressText || venue.city, has.filter(Boolean).join(' · ')]}
            aside={<>
                {price === null ? <small>{t('Rates not published')}</small> : <span><span className="gk-result-price">{money(price, venue.currency)}</span> <small>/ {t('hour')}</small></span>}
                <Status tone={venue.bookingMode === 'INSTANT' ? 'accent' : 'neutral'}>{venue.bookingMode === 'INSTANT' ? t('Instant') : t('On request')}</Status>
            </>}
            action={date ? <ButtonLink size="sm" variant="secondary" to={`/stadiums/${venue.id}${query}`}>{t('See times')}</ButtonLink> : undefined} />
    );
}
