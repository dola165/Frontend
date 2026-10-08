import { Link } from 'react-router-dom';
import { MediaImage } from '../ui/MediaImage';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { ArrowUpRight, GraduationCap, Handshake } from 'lucide-react';
import { money, programmeAge, programmePrice, safePublicUrl, currentProgramme, type ClubPresentation } from '../../features/clubs/presentation';

const panel = 'rounded-xl border border-[var(--club-theme-border-subtle)] bg-[var(--club-theme-surface)] p-5 text-[var(--club-theme-text-primary)]';

export const TrainingPriceHighlight = ({ presentation, clubId }: { presentation?: ClubPresentation | null; clubId?: number }) => {
    const programmes = presentation?.programmes.filter(p => p.published && p.priceType !== 'UNPUBLISHED' && currentProgramme(p)) ?? [];
    if (!programmes.length) return null;
    return <section className="cp-fee-summary" aria-label="Training fees"><p>Training fees</p>{programmes.map(p => <article key={p.id ?? p.name}>
        <p className="cp-fee-name">{p.name}</p><p className="cp-fee-age">{programmeAge(p)}{p.squadIds?.length ? ` · ${p.squadIds.length} linked training ${p.squadIds.length === 1 ? 'group' : 'groups'}` : ' · Confirm the training group'}</p>
        <p className="cp-fee-amount">{programmePrice(p)}</p>
        {p.validUntil && <p className="cp-fee-age">Until {p.validUntil}</p>}
        {p.trialAmount != null && <p className="cp-fee-age">Trial session: {Number(p.trialAmount) === 0 ? 'Free' : money(p.trialAmount,p.currency)}</p>}
        {p.joiningFee != null && <p className="cp-fee-age">Joining fee: {money(p.joiningFee,p.currency)}</p>}
        <a href={`${clubId ? `/clubs/${clubId}` : ''}?tab=teams&programme=${p.id}`}>Programme details <ArrowUpRight size={14} /></a>
    </article>)}</section>;
};

export const ClubProgrammeSection = ({ presentation }: { presentation: ClubPresentation }) => {
    const programmes = presentation.programmes.filter(p => p.published);
    if (!programmes.length) return null;
    return <section id="training-programmes" className={`${panel} scroll-mt-20`}>
        <h2 className="flex items-center gap-2 text-xl font-bold"><GraduationCap size={22} />Training programmes</h2>
        <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">Age groups, training and what is included.</p>
        <div className="mt-5 grid gap-4">
            {programmes.map(p => <article key={p.id} className="rounded-lg border border-[var(--club-theme-border-subtle)] p-4">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">{p.ageMin != null && p.ageMax != null ? `Ages ${p.ageMin}–${p.ageMax}` : p.ageMin != null ? `Ages ${p.ageMin}+` : p.ageMax != null ? `Up to age ${p.ageMax}` : 'Age group: contact the club'}{p.sessionsPerWeek && ` · ${p.sessionsPerWeek} sessions per week`}</p>
                {p.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{p.details}</p>}
            </article>)}
        </div>
    </section>;
};

export const ClubAffiliations = ({ presentation, compact = false }: { presentation: ClubPresentation; compact?: boolean }) => {
    const affiliations = presentation.affiliations.filter(a => a.status === 'ACTIVE');
    if (!affiliations.length && presentation.profileKind !== 'PROFESSIONAL') return null;
    return <section className={`${panel} ${compact ? 'cp-compact-affiliations' : ''}`}>
        <h2 className="text-xl font-bold">{presentation.profileKind !== 'ACADEMY' ? 'Our academies' : 'Affiliated club'}</h2>
        <p className="mt-2 text-sm text-[var(--club-theme-text-secondary)]">{affiliations.length ? 'Affiliations confirmed by both clubs.' : 'No academy affiliations have been confirmed yet.'}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{affiliations.map(a => <div key={a.id} className="rounded-lg border border-[var(--club-theme-border-subtle)] p-4">
            <Link to={`/clubs/${a.clubId}`} className="flex items-center justify-between gap-3 font-semibold hover:text-[var(--club-tone-green)]"><span>{a.name}<span className="mt-1 block text-xs font-normal text-[var(--club-theme-text-secondary)]">{a.profileKind === 'ACADEMY' ? 'Training, programmes & coaches' : 'News, teams & club history'}</span></span><ArrowUpRight size={18} /></Link>
            {a.canManageProfile && <Link to={`/clubs/${a.clubId}/profile-settings`} className="mt-3 inline-block text-sm font-semibold text-[var(--club-tone-green)]">Manage academy profile →</Link>}
        </div>)}</div>
    </section>;
};

export const ClubSponsors = ({ presentation }: { presentation?: ClubPresentation | null }) => {
    const sponsors = presentation?.sponsors.filter(s => s.published && !s.promotionBlocked) ?? [];
    if (!sponsors.length) return null;
    return <section className={panel} aria-label="Our sponsors">
        <h2 className="flex items-center gap-2 text-base font-bold"><Handshake size={18} />Our sponsors</h2>
        <div className="mt-4 grid gap-3">{sponsors.map(s => {
            const logo = s.logoUrl?.startsWith('/uploads/') ? resolveMediaUrl(s.logoUrl) : safePublicUrl(s.logoUrl), website = safePublicUrl(s.websiteUrl);
            const content = <>{logo && <MediaImage src={logo} alt="" className="h-12 w-16 rounded bg-[color:var(--color-elevated)] object-contain p-1" />}<span className="min-w-0 break-words text-sm font-semibold">{s.name}</span>{website && <ArrowUpRight size={14} className="shrink-0" />}</>;
            return website ? <a key={s.id} href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-[var(--club-theme-border-subtle)] p-3">{content}</a> : <div key={s.id} className="flex items-center gap-3 rounded-lg border border-[var(--club-theme-border-subtle)] p-3">{content}</div>;
        })}</div>
    </section>;
};
