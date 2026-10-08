import { appLocale } from '../../utils/formatting';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ExternalLink, Globe, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { buildClubProfileLinks, summarizeClubTrust, toPhoneHref, toWhatsappHref } from './clubProfileInfo';
import { ClubAffiliations, TrainingPriceHighlight } from './ClubPresentation';

interface ClubProfileInfoPanelProps {
    club: ClubProfile;
}

export const ClubProfileInfoPanel = ({ club }: ClubProfileInfoPanelProps) => {
    const phoneHref = toPhoneHref(club.whatsappNumber);
    const whatsappHref = toWhatsappHref(club.whatsappNumber);
    const publicLinks = buildClubProfileLinks(club);
    const trustCount = club.trustedByClubs.length;
    const [nextEventState, setNextEventState] = useState<{clubId:number; event?:{title:string; startsAt:string}; status:string} | null>(null);
    const nextEventLabel = nextEventState?.clubId !== club.id ? 'Checking schedule'
        : nextEventState.event ? `${nextEventState.event.title} | ${new Date(nextEventState.event.startsAt).toLocaleString(appLocale(), {
            month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
        })}` : nextEventState.status;

    useEffect(() => {
        let active = true;

        apiClient.get(`/clubs/${club.id}/calendar`)
            .then((response) => {
                if (!active) return;
                const items = Array.isArray(response.data) ? response.data : [];
                const nextItem = items
                    .filter((item) => item?.startsAt)
                    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                    .find((item) => new Date(item.startsAt).getTime() >= Date.now());

                if (!nextItem) {
                    setNextEventState({clubId:club.id, status:'No event scheduled'});
                    return;
                }

                setNextEventState({clubId:club.id, event:{title:nextItem.title, startsAt:nextItem.startsAt}, status:''});
            })
            .catch(() => {
                if (active) {
                    setNextEventState({clubId:club.id, status:'Schedule unavailable'});
                }
            });

        return () => {
            active = false;
        };
    }, [club.id]);

    const compactLinks = useMemo(() => publicLinks.slice(0, 4), [publicLinks]);

    return (
        <aside className="w-full">
            <section className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)] shadow-[0_16px_30px_color-mix(in_srgb,_var(--color-shadow)_22%,_transparent)]">
                <div className="border-b border-[color:var(--color-border)]/6 px-3.5 py-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--club-theme-text-secondary)]">Club Information</p>
                    <h2 className="mt-2 text-[15px] font-semibold uppercase leading-6 tracking-[0.06em] text-[color:var(--club-theme-text-primary)]">
                        At a glance
                    </h2>
                </div>

                
                <div className="space-y-4 px-4 py-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
                    <PanelSection
                        icon={<Phone className="h-4 w-4 text-[color:var(--club-tone-green)]" />}
                        label="Public Contact"
                    >
                        <p className="text-lg font-semibold tracking-[0.01em] text-[color:var(--club-theme-text-primary)]">
                            {club.whatsappNumber || 'Not published'}
                        </p>
                        <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--club-theme-text-secondary)]">
                            {club.email || 'No public email is published yet.'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {phoneHref ? <InfoLink href={phoneHref} label="Call" /> : null}
                            {whatsappHref ? <InfoLink href={whatsappHref} label="WhatsApp" external /> : null}
                        </div>
                    </PanelSection>

                    <PanelSection
                        icon={<Globe className="h-4 w-4 text-[color:var(--club-tone-blue)]" />}
                        label="Public Links"
                    >
                        {compactLinks.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {compactLinks.map((link) => (
                                    <InfoLink key={`${link.label}-${link.href}`} href={link.href} label={link.label} external />
                                ))}
                            </div>
                        ) : (
                            <p className="text-[12px] leading-5 text-[color:var(--club-theme-text-secondary)]">
                                Website and social links will appear here once published.
                            </p>
                        )}
                    </PanelSection>

                    <PanelSection
                        icon={<MapPin className="h-4 w-4 text-[color:var(--club-tone-cyan)]" />}
                        label="Club Snapshot"
                    >
                        <InfoRow label="Location" value={club.addressText || 'Pending'} multiline />
                        <InfoRow label="Type" value={({SCHOOL:'School / educational team',GRASSROOTS:'Grassroots / community club',ACADEMY:'Academy / youth development',AMATEUR:'Amateur club',SEMI_PROFESSIONAL:'Semi-professional club',PROFESSIONAL:'Professional club',OTHER:'Football club'} as Record<string,string>)[club.type] || 'Football club'} />
                        <InfoRow label="Founded" value={club.foundedYear ? String(club.foundedYear) : 'Pending'} />
                        <InfoRow label="Followers" value={String(club.followerCount ?? 0)} />
                        <InfoRow label="Members" value={String(club.memberCount ?? 0)} />
                    </PanelSection>

                    <PanelSection
                        icon={<CalendarDays className="h-4 w-4 text-[color:var(--club-accent-orange)]" />}
                        label="Next Activity"
                    >
                        <p className="text-[13px] font-semibold leading-5 text-[color:var(--club-theme-text-primary)]">{nextEventLabel}</p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <Tag>{club.statusLabel || (club.isOfficial ? 'Verified' : 'Under review')}</Tag>
                            <Tag>{trustCount > 0 ? `${trustCount} trust links` : 'Trust building'}</Tag>
                        </div>
                        <p className="mt-2.5 text-[12px] leading-5 text-[color:var(--club-theme-text-secondary)]">
                            {summarizeClubTrust(club)}
                        </p>
                        {club.trustedByClubs.length > 0 ? (
                            <div className="mt-2.5 flex flex-wrap gap-2">
                                {club.trustedByClubs.slice(0, 3).map((trustedClub) => (
                                    <Tag key={trustedClub.clubId}>{trustedClub.clubName}</Tag>
                                ))}
                            </div>
                        ) : null}
                    </PanelSection>
                </div>
                <div className="px-4 pb-4"><TrainingPriceHighlight clubId={club.id} presentation={club.presentation} />{club.presentation && <ClubAffiliations presentation={club.presentation} compact />}</div>
            </section>
        </aside>
    );
};

const PanelSection = ({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) => (
    <section className="border-b border-[color:var(--color-border)]/6 pb-4 last:border-b-0 last:pb-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold  text-[color:var(--club-theme-text-secondary)]">
            {icon}
            {label}
        </div>
        <div className="mt-2.5">{children}</div>
    </section>
);

const InfoRow = ({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) => (
    <div className={`mt-2 flex gap-3 rounded-[10px] bg-[color:var(--color-ink)]/[0.03] px-2.5 py-2 ${multiline ? 'items-start' : 'items-center justify-between'}`}>
        <span className="shrink-0 text-[9px] font-semibold  text-[color:var(--club-theme-text-secondary)]">{label}</span>
        <span className={`text-[13px] font-semibold text-[color:var(--club-theme-text-primary)] ${multiline ? 'leading-5' : ''}`}>{value}</span>
    </div>
);

const InfoLink = ({ href, label, external = false }: { href: string; label: string; external?: boolean }) => (
    <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)]/8 bg-[color:var(--color-ink)]/[0.04] px-2.5 py-1.5 text-[9px] font-semibold  text-[color:var(--club-theme-text-primary)]"
    >
        {label}
        {external ? <ExternalLink className="h-3 w-3" /> : null}
    </a>
);

const Tag = ({ children }: { children: ReactNode }) => (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-ink)]/[0.05] px-2 py-1 text-[9px] font-semibold  text-[color:var(--club-theme-text-secondary)]">
        <ShieldCheck className="h-2.5 w-2.5 text-[color:var(--club-tone-green)]" />
        {children}
    </span>
);
