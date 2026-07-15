import { type ReactNode } from 'react';
import { ExternalLink, Globe, Mail, MapPin, MessageSquare, Phone, ShieldCheck } from 'lucide-react';
import type { ClubProfile } from '../../../pages/ClubProfilePage';
import { buildClubProfileLinks, summarizeClubTrust, toPhoneHref, toWhatsappHref } from '../clubProfileInfo';

export const TabContact = ({ club }: { club: ClubProfile }) => {
    const phoneHref = toPhoneHref(club.whatsappNumber);
    const whatsappHref = toWhatsappHref(club.whatsappNumber);
    const links = buildClubProfileLinks(club);

    return (
        <section className="rounded-[24px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] p-5 shadow-[0_18px_32px_rgba(2,6,12,0.22)]">
            <div className="mb-5">
                <p className="text-[11px] font-semibold  text-[color:var(--club-tone-green)]">Contact</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--club-theme-text-primary)]">Reach club staff</h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Primary contact" icon={<Phone className="h-4 w-4" />}>
                    <p className="text-lg font-semibold text-[color:var(--club-theme-text-primary)]">{club.whatsappNumber || 'Not published'}</p>
                    <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">{club.email || 'Email not published'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {phoneHref ? <ActionLink href={phoneHref} label="Call" /> : null}
                        {whatsappHref ? <ActionLink href={whatsappHref} label="WhatsApp" /> : null}
                        {club.facebookMessengerUrl ? <ActionLink href={club.facebookMessengerUrl} label="Messenger" external /> : null}
                    </div>
                </Card>

                <Card title="Location" icon={<MapPin className="h-4 w-4" />}>
                    <p className="text-lg font-semibold text-[color:var(--club-theme-text-primary)]">{club.addressText || 'Location pending'}</p>
                    <p className="mt-2 text-sm text-[color:var(--club-theme-text-secondary)]">{club.type || 'Club profile'}</p>
                </Card>

                <Card title="Public links" icon={<Globe className="h-4 w-4" />}>
                    <div className="flex flex-wrap gap-2">
                        {links.length > 0 ? links.map((link) => (
                            <ActionLink key={link.href} href={link.href} label={link.label} external />
                        )) : <p className="text-sm text-[color:var(--club-theme-text-secondary)]">No public links published yet.</p>}
                    </div>
                </Card>

                <Card title="Club trust" icon={<ShieldCheck className="h-4 w-4" />}>
                    <p className="text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">{summarizeClubTrust(club)}</p>
                    {club.trustedByClubs.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {club.trustedByClubs.map((trustedClub) => (
                                <span key={trustedClub.clubId} className="rounded-full bg-white/[0.05] px-3 py-2 text-[10px] font-semibold  text-[color:var(--club-theme-text-primary)]">
                                    {trustedClub.clubName}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </Card>
            </div>
        </section>
    );
};

const Card = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
    <article className="rounded-[18px] border border-white/6 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold  text-[color:var(--club-tone-green)]">
            {icon}
            {title}
        </div>
        <div className="mt-4">{children}</div>
    </article>
);

const ActionLink = ({ href, label, external = false }: { href: string; label: string; external?: boolean }) => (
    <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold  text-[color:var(--club-theme-text-primary)]"
    >
        {label === 'Messenger' ? <MessageSquare className="h-3.5 w-3.5" /> : null}
        {label === 'Email' ? <Mail className="h-3.5 w-3.5" /> : null}
        {label}
        {external ? <ExternalLink className="h-3.5 w-3.5" /> : null}
    </a>
);
