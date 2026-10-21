import { usePagesCopy } from '../../pages/copy';
import { useSearchParams } from 'react-router-dom';
import { Globe2, Instagram, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { Badge, ButtonLink, List, ListRow, Panel, Section } from '../../../design/primitives';
import { safePublicUrl } from '../presentation';
import { summarizeClubTrust, toPhoneHref, toWhatsappHref } from '../../../components/club/clubProfileInfo';
import { usePageEditIfAny } from '../../pages/edit/context';
import { phoneDisplay } from '../../pages/model/phone';
import type { ClubProfile } from './types';

/** How to reach the club, with the context of a role enquiry when one brought the visitor here. */
export function ClubContactTab({ club }: { club: ClubProfile }) {
    const t = usePagesCopy();
    const [params] = useSearchParams();
    const roleId = params.get('roleId'), roleTitle = params.get('roleTitle')?.trim();
    // A club with a page: what the owner entered there.
    const page = usePageEditIfAny()?.page ?? null;
    const number = page ? page.identity.contact.phone : club.whatsappNumber, email = page ? page.identity.contact.email : club.email;
    const phone = toPhoneHref(number), whatsapp = toWhatsappHref(number);
    const links = [
        { href: safePublicUrl(club.websiteUrl), label: 'Website', icon: Globe2 },
        { href: safePublicUrl(club.instagramUrl), label: 'Instagram', icon: Instagram },
        { href: safePublicUrl(club.facebookMessengerUrl), label: 'Messenger', icon: MessageCircle },
        ...club.opportunities.filter(o => safePublicUrl(o.externalLink)).slice(0, 4).map(o => ({ href: safePublicUrl(o.externalLink), label: o.type === 'FUNDRAISING' ? 'Fundraising' : o.type === 'JOB' ? 'Jobs' : 'Volunteer', icon: Globe2 })),
    ].filter((link): link is { href: string; label: string; icon: typeof Globe2 } => Boolean(link.href));
    return <>
        {roleId && roleTitle && <div className="gk-notice" role="note">
            <span><strong>Asking about {roleTitle}?</strong> Use the details below and mention the role. Nothing has been submitted or tracked in the app yet.</span>
            <ButtonLink size="sm" to={`/jobs/${encodeURIComponent(roleId)}`}>{t("Back to the role")}</ButtonLink>
        </div>}
        <Section boxed title={t("Contact")}>
            <Panel flush><List label={t("Contact details")}>
                <ListRow lead={<span className="gk-club-icon"><Phone aria-hidden="true" /></span>} title={number ? phoneDisplay(number) : t('Phone not published')} meta={t("Phone and WhatsApp")}
                    trail={<span className="gk-row">{phone && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={phone}>{t("Call")}</a>}{whatsapp && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</span>} />
                <ListRow lead={<span className="gk-club-icon"><Mail aria-hidden="true" /></span>} title={email || t('Email not published')} meta={t("Email")}
                    trail={email ? <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`mailto:${email}`}>{t("Write")}</a> : undefined} />
                <ListRow lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={club.addressText || t('Address not published')} meta={t("Where the club is based. Training grounds are under Facilities.")} />
            </List></Panel>
        </Section>
        <Section boxed title={t("Online")}>
            <Panel padded>{links.length ? <div className="gk-profile-links">{links.map(link => <a key={link.href} className="gk-btn gk-btn--secondary gk-btn--sm" href={link.href} target="_blank" rel="noopener noreferrer"><link.icon aria-hidden="true" />{t(link.label)}</a>)}</div>
                : <p className="gk-muted">{t("No public links published yet.")}</p>}</Panel>
        </Section>
        <Section boxed title={t("Trust")}>
            <Panel padded><div className="gk-stack gk-stack--tight">
                <p className="gk-row"><ShieldCheck aria-hidden="true" size={18} />{summarizeClubTrust(club)}</p>
                {club.trustedByClubs.length > 0 && <div className="gk-chips">{club.trustedByClubs.map(t => <Badge key={t.clubId}>{t.clubName}</Badge>)}</div>}
            </div></Panel>
        </Section>
    </>;
}
