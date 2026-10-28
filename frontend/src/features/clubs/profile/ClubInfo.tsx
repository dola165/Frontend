import { usePagesCopy } from '../../pages/copy';
import { Link } from 'react-router-dom';
import { Mail, MapPin, PenLine, Phone } from 'lucide-react';
import { EmptyNote, List, ListRow, Skeleton } from '../../../design/primitives';
import { SideBlock } from '../../../design/profile/ProfileLayout';
import { toPhoneHref } from '../../../components/club/clubProfileInfo';
import type { PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import { useOverviewSource } from '../useOverviewSource';
import { usePageEditIfAny } from '../../pages/edit/context';
import { feeBandText } from '../../pages/model/fees';
import { phoneDisplay } from '../../pages/model/phone';
import { feeRange } from './fees';
import type { ClubTab } from './clubTabs';
import type { ClubProfile } from './types';

const tabLink = (club: number, tab: string) => `/clubs/${club}?tab=${tab}`;

/** A quiet Edit link for the club's own staff, beside a block's other action. */
export const EditLink = ({ to }: { to: string }) => { const t = usePagesCopy(); return <Link className="gk-section__action gk-row gk-club-edit" to={to}><PenLine size={13} aria-hidden="true" />{t('Edit')}</Link>; };

/**
 * The left column beside every club tab: how to reach the club, what training costs and where it happens. Staff get an
 * Edit on each block. A block the open tab already shows in full (Contact, Facilities) stays out of this column there.
 */
export function ClubInfo({ club, tab, canEdit = false }: { club: ClubProfile; tab?: ClubTab; canEdit?: boolean }) {
    const t = usePagesCopy();
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    // A club with a page keeps its contact and fee band there: visitors read what the owner entered, as the owner saw it.
    const page = usePageEditIfAny()?.page ?? null;
    const number = page ? page.identity.contact.phone : club.whatsappNumber, email = page ? page.identity.contact.email : club.email;
    const phone = toPhoneHref(number);
    const fees = feeRange(club.presentation?.programmes ?? []) ?? feeBandText(page?.boxes.fees.band ?? null, { free: t('Free training'), month: t('month'), someFree: t('Some groups train free') });
    // Playing venues first: they are where a visitor goes.
    const venues = [...(places.data ?? [])].sort((a, b) => Number(placeType(b) === 'VENUE') - Number(placeType(a) === 'VENUE')).slice(0, 3);
    // Visitors never see an empty block; the club's own staff keep them, with their Edit links.
    const empty = { contact: !phone && !email, fees: !fees, places: !places.loading && venues.length === 0 };
    const shown = { contact: tab !== 'contact', places: tab !== 'facilities' };
    return <>
        {shown.contact && (canEdit || !empty.contact) && <SideBlock title={t("Contact")} hint={t("Phone and email")} action={<span className="gk-row">{canEdit && <EditLink to={`/clubs/${club.id}?edit=1&panel=contact`} />}<Link className="gk-section__action" to={tabLink(club.id, 'contact')}>{t("All details")}</Link></span>}>
            {phone || email ? <List label={t("Contact details")}>
                {phone && <li><a className="gk-list-row" href={phone}><span className="gk-list-row__lead"><span className="gk-club-icon"><Phone aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title">{phoneDisplay(number ?? '')}</span><span className="gk-list-row__meta">{t("Phone and WhatsApp")}</span></span></a></li>}
                {email && <li><a className="gk-list-row" href={`mailto:${email}`}><span className="gk-list-row__lead"><span className="gk-club-icon"><Mail aria-hidden="true" /></span></span><span className="gk-list-row__main"><span className="gk-list-row__title gk-club-email">{email}</span><span className="gk-list-row__meta">{t("Email")}</span></span></a></li>}
            </List> : <p>{t("Not published yet.")}</p>}
        </SideBlock>}
        {(canEdit || !empty.fees) && <SideBlock title={t("Training fees")} hint={t("Lowest to highest group")} action={<span className="gk-row">{canEdit && <EditLink to={`/clubs/${club.id}?edit=1&panel=fees`} />}<Link className="gk-section__action" to={tabLink(club.id, 'teams')}>{t("All groups")}</Link></span>}>
            {fees ? <p className="gk-club-fees"><strong className="gk-num">{fees.range}</strong>{fees.note && <span className="gk-muted">{t(fees.note)}</span>}</p> : <p>{t("Ask the club about fees.")}</p>}
        </SideBlock>}
        {shown.places && (canEdit || !empty.places) && <SideBlock title={t("Facilities")} hint={t("Where the club plays and trains")} action={<span className="gk-row">{canEdit && <EditLink to={page?.viewer.canEdit ? `/clubs/${club.id}?edit=1&panel=grounds` : `/clubs/${club.id}/office?tab=tools&tool=facilities`} />}<Link className="gk-section__action" to={tabLink(club.id, 'facilities')}>{t("All facilities")}</Link></span>}>
            {places.loading ? <Skeleton height={44} /> : venues.length ? <List label={t("Facilities")}>{venues.map(v => <ListRow key={v.id} to={`${tabLink(club.id, 'facilities')}&place=${v.id}`}
                lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={v.title} meta={v.details.address || v.linkedVenue?.address || v.squadName || t('Address on the facility page')} />)}</List>
                : <EmptyNote title={t("No facilities published yet")} />}
        </SideBlock>}
    </>;
}
