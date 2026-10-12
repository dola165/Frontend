import { useSearchParams } from 'react-router-dom';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { Status } from '../../../design/DataTable';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { fetchVenue, formats, surfaces } from '../../venues/api';
import { fromPrice, money } from '../../venues/utils';
import { plural, useWorldCopy } from '../copy';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import './peek.css';
import './match/match-peek.css';

/**
 * A venue beside the list: its photo, address and how booking works, its pitches with their hourly rates, and "See
 * times" on the venue's page (with the date and length chosen in the list, when there are).
 */
export default function VenuePeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const [params] = useSearchParams();
    const venueId = Number(id);
    const valid = Number.isInteger(venueId) && venueId > 0;
    const data = useWorldData(valid ? `venue-peek:${venueId}` : null, signal => fetchVenue(venueId, signal), 'This venue could not load.');
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    const venue = data.data;
    if (!venue) return (
        <DrawerFrame title={t('Venue')}>
            <EmptyNote title={data.error || t('This venue could not load.')} action={valid ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    const date = params.get('date');
    const page = `/stadiums/${venue.id}${date ? `?date=${date}&duration=${params.get('durationMinutes') || 60}` : ''}`;
    const pitches = venue.pitches.filter(pitch => pitch.active);
    const price = fromPrice(venue);
    const photo = resolveMediaUrl(venue.photos[0]?.url);
    return (
        <DrawerFrame title={venue.displayName} page={{ to: page, label: t('Venue page') }}>
            {photo && <MediaImage className="gk-tpeek__banner" src={photo} alt="" />}
            <header className="gk-peek-job">
                <h3>{venue.displayName}</h3>
                <p className="gk-peek-job__meta">{venue.addressText || venue.city}</p>
                <div className="gk-peek-job__chips">
                    <Status tone={venue.bookingMode === 'INSTANT' ? 'accent' : 'neutral'}>{venue.bookingMode === 'INSTANT' ? t('Instant confirmation') : t('Request to book')}</Status>
                    {price !== null && <span className="gk-peek-chip">{t('from {price} / hour', { price: money(price, venue.currency) })}</span>}
                </div>
            </header>
            <div className="gk-peek-actions"><ButtonLink size="sm" variant="primary" to={page}>{date ? t('See times') : t('See times and book')}</ButtonLink></div>
            {venue.description && <p className="gk-peek-about">{venue.description}</p>}
            <section className="gk-peek-section">
                <h3 className="gk-peek-section__title">{pitches.length ? plural(pitches.length, 'pitch', 'pitches') : t('No bookable pitches')}</h3>
                <ul className="gk-peek-list">{pitches.map(pitch => (
                    <li key={pitch.id} className="gk-peek-club">
                        <span>
                            <b>{pitch.name}</b>
                            <small>{[t(formats[pitch.format]), t(surfaces[pitch.surface]), pitch.covered ? t('Covered') : null, `${money(pitch.pricePerHour, venue.currency)} / ${t('hour')}`].filter(Boolean).join(' · ')}</small>
                        </span>
                    </li>
                ))}</ul>
            </section>
        </DrawerFrame>
    );
}
