import { ButtonLink } from '../../../design/primitives';
import { fetchVenues, formats, surfaces, type Venue } from '../../venues/api';
import { MyVenueBookings } from '../../venues/VenueBookings';
import { fromPrice, money, today } from '../../venues/utils';
import { useWorldCopy, wt } from '../copy';
import { VenueCard } from '../cards/VenueCard';
import { DirectoryPage } from '../directory/DirectoryPage';
import { first, type DirectorySource } from '../directory/types';
import '../../venues/venues.css';

const PAGE = 12;
interface VenueItem { venue: Venue; date?: string; duration?: string }

const venues: DirectorySource<VenueItem> = {
    id: 'venues',
    label: 'Venues',
    tabLabel: 'Find a venue',
    noun: ['venue', 'venues'],
    searchLabel: 'Search venues',
    searchPlaceholder: 'Search stadiums and pitches by name or area',
    layout: 'cards',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'format', label: 'Pitch format', primary: true, allLabel: 'Any format', options: Object.entries(formats).filter(([key]) => key !== 'OTHER').map(([value, label]) => ({ value, label })) },
        { kind: 'toggle', key: 'covered', label: 'Covered', primary: true },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
        { kind: 'choice', key: 'surface', label: 'Surface', allLabel: 'Any surface', options: Object.entries(surfaces).map(([value, label]) => ({ value, label })) },
        { kind: 'date', key: 'date', label: 'Free on', min: () => today() },
        { kind: 'choice', key: 'durationMinutes', label: 'For how long', fallback: '60', options: [{ value: '60', label: '1 hour' }, { value: '90', label: '1½ hours' }, { value: '120', label: '2 hours' }, { value: '180', label: '3 hours' }], when: query => Boolean(first(query, 'date')) },
        { kind: 'text', key: 'minPrice', label: 'Lowest hourly rate', placeholder: 'From' },
        { kind: 'text', key: 'maxPrice', label: 'Highest hourly rate', placeholder: 'Any rate' },
        { kind: 'choice', key: 'currency', label: 'Rate currency', fallback: 'GEL', options: ['GEL', 'USD', 'EUR', 'GBP'].map(value => ({ value, label: value })), when: query => Boolean(first(query, 'minPrice') || first(query, 'maxPrice')) },
    ],
    async load(query, page, { signal }) {
        const date = first(query, 'date') || undefined;
        // Free times exist only from today on; an older date in a link is named rather than ignored.
        if (date && date < today()) return { items: [], total: null, hasMore: false, notice: wt('Choose today or a later date to see free times.') };
        const minPrice = Number(first(query, 'minPrice')) || undefined, maxPrice = Number(first(query, 'maxPrice')) || undefined;
        const result = await fetchVenues({
            q: query.q || undefined, city: first(query, 'city') || undefined, format: first(query, 'format') || undefined,
            surface: first(query, 'surface') || undefined, covered: first(query, 'covered') === 'true' ? true : undefined,
            minPrice, maxPrice, currency: minPrice || maxPrice ? first(query, 'currency') || 'GEL' : undefined, date, durationMinutes: Number(first(query, 'durationMinutes')) || 60, page, size: PAGE,
        }, signal);
        return { items: result.content.map(venue => ({ venue, date, duration: first(query, 'durationMinutes') || undefined })), total: result.totalElements, hasMore: (page + 1) * PAGE < result.totalElements };
    },
    key: item => String(item.venue.id),
    Item: ({ item }) => <VenueCard venue={item.venue} date={item.date} duration={item.duration} />,
    line: ({ venue, date, duration }) => {
        const price = fromPrice(venue);
        return { title: venue.displayName, to: `/stadiums/${venue.id}${date ? `?date=${date}&duration=${duration || 60}` : ''}`,
            crest: { src: venue.logoUrl ?? venue.photos[0]?.url, name: venue.displayName }, detail: venue.addressText || venue.city,
            fact: price === null ? undefined : `${money(price, venue.currency)} / ${wt('hour')}` };
    },
    placeKinds: ['STADIUM'],
    place: ({ venue }, places) => {
        const known = venue.latitude != null && venue.longitude != null ? { lat: venue.latitude, lng: venue.longitude } : places.venue(venue.id);
        return known ? { ...known, label: venue.displayName, meta: venue.city, tone: 'venue', noun: ['venue', 'venues'], to: `/stadiums/${venue.id}` } : null;
    },
    mapLink: query => `/world/map?layers=venues${query.q ? `&q=${encodeURIComponent(query.q)}` : ''}${first(query, 'city') ? `&region=${encodeURIComponent(first(query, 'city'))}` : ''}`,
    empty: { title: 'No venues listed yet', body: 'Stadium owners can create a page and open their calendar for bookings.', action: <ListStadium /> },
};

function ListStadium() {
    const t = useWorldCopy();
    return <ButtonLink size="sm" to="/organizations/create?kind=VENUE">{t('List your stadium')}</ButtonLink>;
}

/** World › Venues: pitches to hire, and the person's own reservations. */
export default function VenuesDirectory() {
    const t = useWorldCopy();
    return (
        <DirectoryPage
            title={t('Venues')}
            subtitle={t('Pitches to hire')}
            sources={[venues]}
            extraTabs={[{ id: 'bookings', label: 'My reservations', personal: true, element: <div className="venue-page"><MyVenueBookings /></div> }]}
            actions={<ButtonLink variant="ghost" to="/organizations/create?kind=VENUE">{t('List your stadium')}</ButtonLink>}
        />
    );
}
