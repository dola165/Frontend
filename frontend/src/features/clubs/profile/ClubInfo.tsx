import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { EmptyNote, List, ListRow, Skeleton } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { toPhoneHref } from '../../../components/club/clubProfileInfo';
import type { PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import { useOverviewSource } from '../useOverviewSource';
import { feeRange } from './fees';
import type { ClubProfile } from './types';

const tabLink = (club: number, tab: string) => `/clubs/${club}?tab=${tab}`;

/** The left column beside every club tab: how to reach the club, what training costs and where it happens. */
export function ClubInfo({ club }: { club: ClubProfile }) {
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    const phone = toPhoneHref(club.whatsappNumber);
    const fees = feeRange(club.presentation?.programmes ?? []);
    // Playing venues first: they are where a visitor goes.
    const venues = [...(places.data ?? [])].sort((a, b) => Number(placeType(b) === 'VENUE') - Number(placeType(a) === 'VENUE')).slice(0, 3);
    return <>
        <SideBlock title="Contact" hint="Phone and email" action={<Link className="gk-section__action" to={tabLink(club.id, 'contact')}>All details</Link>}>
            {phone || club.email ? <List label="Contact details">
                {phone && <li><a className="gk-list-row" href={phone}><span className="gk-list-row__lead"><span className="gk-club-icon"><Phone aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">{club.whatsappNumber}</span><span className="gk-list-row__meta">Phone and WhatsApp</span></span></a></li>}
                {club.email && <li><a className="gk-list-row" href={`mailto:${club.email}`}><span className="gk-list-row__lead"><span className="gk-club-icon"><Mail aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title gk-club-email">{club.email}</span><span className="gk-list-row__meta">Email</span></span></a></li>}
            </List> : <p>Not published yet.</p>}
        </SideBlock>
        <SideBlock title="Training fees" hint="Lowest to highest group" action={<Link className="gk-section__action" to={tabLink(club.id, 'teams')}>All groups</Link>}>
            {fees ? <p className="gk-club-fees"><strong className="gk-num">{fees.range}</strong>{fees.note && <span className="gk-muted">{fees.note}</span>}</p> : <p>Ask the club about fees.</p>}
        </SideBlock>
        <SideBlock title="Facilities" hint="Where the club plays and trains" action={<Link className="gk-section__action" to={tabLink(club.id, 'facilities')}>All facilities</Link>}>
            {places.loading ? <Skeleton height={44} /> : venues.length ? <List label="Facilities">{venues.map(v => <ListRow key={v.id} to={`${tabLink(club.id, 'facilities')}&place=${v.id}`}
                lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={v.title} meta={v.details.address || v.linkedVenue?.address || v.squadName || 'Address on the facility page'} />)}</List>
                : <EmptyNote title="No facilities published yet" />}
        </SideBlock>
    </>;
}
