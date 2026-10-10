import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe2, Instagram, Mail, MessageCircle, Phone } from 'lucide-react';
import { ButtonLink, List, ListRow } from '../../../design/primitives';
import { Fact, SideBlock } from '../../../design/profile/ProfileLayout';
import { Crest } from '../../world/Crest';
import { profileKindLabel, safePublicUrl } from '../presentation';
import { toPhoneHref, toWhatsappHref, summarizeClubTrust } from '../../../components/club/clubProfileInfo';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useClubOpportunityPreview } from './useClubOpportunityPreview';
import type { ClubProfile } from './types';

/** Side facts shown beside every club tab: who the club is, how to reach it and how to get involved. */
export function ClubSide({ club, showContact = true }: { club: ClubProfile; showContact?: boolean }) {
    const opportunities = useClubOpportunityPreview(club.id);
    const sponsors = club.presentation?.sponsors.filter(s => s.published && !s.promotionBlocked) ?? [];
    const affiliations = club.presentation?.affiliations.filter(a => a.status === 'ACTIVE') ?? [];
    const contact = contactLinks(club);
    return <>
        <SideBlock title="About">
            {club.description && <p className="gk-club-about">{club.description}</p>}
            <dl>
                <Fact label="Type">{club.presentation ? profileKindLabel[club.presentation.profileKind] : club.type || 'Football club'}</Fact>
                {club.foundedYear && <Fact label="Founded">{club.foundedYear}</Fact>}
                {club.addressText && <Fact label="Based at">{club.addressText}</Fact>}
                <Fact label="Status">{summarizeClubTrust(club)}</Fact>
            </dl>
        </SideBlock>
        {showContact && <SideBlock title="Contact" action={<Link className="gk-section__action" to={`/clubs/${club.id}?tab=contact`}>All details</Link>}>
            {contact.length ? <div className="gk-profile-links">{contact.map(link => <a key={link.href} className="gk-btn gk-btn--secondary gk-btn--sm" href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined}><link.icon aria-hidden="true" />{link.label}</a>)}</div>
                : <p>The club has not published contact details yet. You can still send a message from this page.</p>}
        </SideBlock>}
        <SideBlock title="Get involved" action={<Link className="gk-section__action" to={`/clubs/${club.id}?tab=business`}>All opportunities</Link>}>
            <List label="Ways to get involved">{opportunities.map(item => <ListRow key={item.key} to={item.to}
                lead={<span className="gk-club-icon"><item.icon aria-hidden="true" /></span>} title={item.title}
                meta={item.source.loading ? 'Loading…' : item.source.failed ? 'Currently unavailable' : item.count ? `${item.count} ${item.count === 1 ? item.unit.replace(/s$/, '') : item.unit}` : item.empty} />)}</List>
        </SideBlock>
        {/* The academy link itself sits under the club name; only managing it stays here. */}
        {affiliations.some(a => a.canManageProfile) && <SideBlock title="Academy profile">
            {affiliations.filter(a => a.canManageProfile).map(a => <ButtonLink key={a.id} size="sm" to={`/clubs/${a.clubId}/profile-settings`}>Manage {a.name} profile</ButtonLink>)}
        </SideBlock>}
        {sponsors.length > 0 && <SideBlock title="Sponsors">
            <List label="Sponsors">{sponsors.map(s => {
                const website = safePublicUrl(s.websiteUrl);
                const logo = s.logoUrl?.startsWith('/uploads/') ? resolveMediaUrl(s.logoUrl) : safePublicUrl(s.logoUrl);
                return <li key={s.id ?? s.name}>{website
                    ? <a className="gk-list-row" href={website} target="_blank" rel="noopener noreferrer"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span><ArrowUpRight aria-hidden="true" className="gk-faint" size={16} /></a>
                    : <div className="gk-list-row"><Crest src={logo} name={s.name} size={36} /><span className="gk-list-row__main"><span className="gk-list-row__title">{s.name}</span></span></div>}</li>;
            })}</List>
        </SideBlock>}
    </>;
}

function contactLinks(club: ClubProfile) {
    const links: Array<{ href: string; label: string; icon: typeof Phone; external: boolean }> = [];
    const phone = toPhoneHref(club.whatsappNumber), whatsapp = toWhatsappHref(club.whatsappNumber);
    if (phone) links.push({ href: phone, label: 'Call', icon: Phone, external: false });
    if (whatsapp) links.push({ href: whatsapp, label: 'WhatsApp', icon: MessageCircle, external: true });
    if (club.email) links.push({ href: `mailto:${club.email}`, label: 'Email', icon: Mail, external: false });
    const website = safePublicUrl(club.websiteUrl), instagram = safePublicUrl(club.instagramUrl), messenger = safePublicUrl(club.facebookMessengerUrl);
    if (website) links.push({ href: website, label: 'Website', icon: Globe2, external: true });
    if (instagram) links.push({ href: instagram, label: 'Instagram', icon: Instagram, external: true });
    if (messenger) links.push({ href: messenger, label: 'Messenger', icon: MessageCircle, external: true });
    return links;
}
