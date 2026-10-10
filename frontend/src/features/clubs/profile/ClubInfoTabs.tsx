import { useSearchParams } from 'react-router-dom';
import { Globe2, Instagram, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Trophy } from 'lucide-react';
import { Badge, ButtonLink, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import { safePublicUrl } from '../presentation';
import { summarizeClubTrust, toPhoneHref, toWhatsappHref } from '../../../components/club/clubProfileInfo';
import type { ClubProfile } from './types';

/** Every recorded trophy and milestone, newest first. */
export function ClubHonoursTab({ club }: { club: ClubProfile }) {
    const honours = [...(club.honours ?? [])].sort((a, b) => b.yearWon - a.yearWon);
    return <Section title="Honours" hint={honours.length ? `${honours.length} recorded` : undefined}>
        <Panel flush>{honours.length ? <List label="Honours">{honours.map(h => <ListRow key={h.id}
            lead={<span className="gk-club-year gk-num">{h.yearWon}</span>} title={h.title} meta={h.description || 'Recorded in the club archive.'}
            trail={<Trophy aria-hidden="true" size={18} />} />)}</List>
            : <EmptyNote title="No honours recorded yet">Trophies, league finishes and milestones appear here once the club records them.</EmptyNote>}</Panel>
    </Section>;
}

/** How to reach the club, with the context of a role enquiry when one brought the visitor here. */
export function ClubContactTab({ club }: { club: ClubProfile }) {
    const [params] = useSearchParams();
    const roleId = params.get('roleId'), roleTitle = params.get('roleTitle')?.trim();
    const phone = toPhoneHref(club.whatsappNumber), whatsapp = toWhatsappHref(club.whatsappNumber);
    const links = [
        { href: safePublicUrl(club.websiteUrl), label: 'Website', icon: Globe2 },
        { href: safePublicUrl(club.instagramUrl), label: 'Instagram', icon: Instagram },
        { href: safePublicUrl(club.facebookMessengerUrl), label: 'Messenger', icon: MessageCircle },
        ...club.opportunities.filter(o => safePublicUrl(o.externalLink)).slice(0, 4).map(o => ({ href: safePublicUrl(o.externalLink), label: o.type === 'FUNDRAISING' ? 'Fundraising' : o.type === 'JOB' ? 'Roles' : 'Volunteer', icon: Globe2 })),
    ].filter((link): link is { href: string; label: string; icon: typeof Globe2 } => Boolean(link.href));
    return <>
        {roleId && roleTitle && <div className="gk-notice" role="note">
            <span><strong>Asking about {roleTitle}?</strong> Use the details below and mention the role. Nothing has been submitted or tracked in the app yet.</span>
            <ButtonLink size="sm" to={`/jobs/${encodeURIComponent(roleId)}`}>Back to the role</ButtonLink>
        </div>}
        <Section title="Contact">
            <Panel flush><List label="Contact details">
                <ListRow lead={<span className="gk-club-icon"><Phone aria-hidden="true" /></span>} title={club.whatsappNumber || 'Phone not published'} meta="Phone and WhatsApp"
                    trail={<span className="gk-row">{phone && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={phone}>Call</a>}{whatsapp && <a className="gk-btn gk-btn--secondary gk-btn--sm" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</span>} />
                <ListRow lead={<span className="gk-club-icon"><Mail aria-hidden="true" /></span>} title={club.email || 'Email not published'} meta="Email"
                    trail={club.email ? <a className="gk-btn gk-btn--secondary gk-btn--sm" href={`mailto:${club.email}`}>Write</a> : undefined} />
                <ListRow lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={club.addressText || 'Address not published'} meta="Where the club is based. Training venues are listed under Venues." />
            </List></Panel>
        </Section>
        <Section title="Online">
            <Panel padded>{links.length ? <div className="gk-profile-links">{links.map(link => <a key={link.href} className="gk-btn gk-btn--secondary gk-btn--sm" href={link.href} target="_blank" rel="noopener noreferrer"><link.icon aria-hidden="true" />{link.label}</a>)}</div>
                : <p className="gk-muted">No public links published yet.</p>}</Panel>
        </Section>
        <Section title="Trust">
            <Panel padded><div className="gk-stack gk-stack--tight">
                <p className="gk-row"><ShieldCheck aria-hidden="true" size={18} />{summarizeClubTrust(club)}</p>
                {club.trustedByClubs.length > 0 && <div className="gk-chips">{club.trustedByClubs.map(t => <Badge key={t.clubId}>{t.clubName}</Badge>)}</div>}
            </div></Panel>
        </Section>
    </>;
}
