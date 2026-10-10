import { useEffect, useRef } from 'react';
import { ArrowLeft, BadgeCheck, BookmarkPlus, ExternalLink, Footprints, MessageCircle, Navigation, Share2 } from 'lucide-react';
import { apiClient } from '../../../../api/axiosConfig';
import type { ClubProfile } from '../../../../components/discovery/clubDirectoryTypes';
import { Badge, Button, ButtonLink, List, ListRow } from '../../../../design/primitives';
import { resolveMediaUrl } from '../../../../utils/resolveMediaUrl';
import { useAdmissionCopy } from '../../../admissions/applicant/copy';
import { playerPath } from '../../../parents/playerSelection';
import { Crest } from '../../Crest';
import { useWorldCopy, wt } from '../../copy';
import { appLocale } from '../../../../utils/formatting';
import { useWorldData } from '../../useWorldData';
import { PlaceLead } from './ResultsList';
import { distanceLabel, typeLabel, type PlaceRecord } from './records';
import './explore.css';

interface ClubDetails extends ClubProfile {
    bannerUrl?: string | null; whatsappNumber?: string | null; facebookMessengerUrl?: string | null;
    trustedByClubs?: { clubId: number; clubName: string }[]; opportunities?: { id: number; type: string; title: string; externalLink?: string | null }[];
}
const JOIN: Record<string, string> = { OPEN_TRIAL: 'Open trials', APPLICATION_REQUIRED: 'Apply to join', INVITE_ONLY: 'Invite only' };
const whenFormat = (date: Date) => new Intl.DateTimeFormat(appLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

/** Where the place's own page is, and what its main button says. */
function destination(record: PlaceRecord, playerId?: number) {
    const id = record.marker?.entityId;
    if (record.opportunity) return { label: wt('View joining arrangements'), to: playerPath(`/admissions/opportunities/${record.opportunity.id}`, playerId) };
    switch (record.entityType) {
        case 'STADIUM': return id ? { label: wt('View availability'), to: `/stadiums/${id}` } : null;
        case 'MATCH': return record.marker?.scheduleEventId ? { label: wt('Open match'), to: `/match-exchange/${record.marker.scheduleEventId}` } : record.clubId ? { label: wt('Open club'), to: `/clubs/${record.clubId}` } : null;
        case 'TRYOUT': return id ? { label: wt('View trial and apply'), to: `/tryouts/${id}` } : null;
        case 'TOURNAMENT': return id ? { label: wt('Open competition'), to: `/tournaments/${id}` } : null;
        default: return record.clubId ? { label: wt('Open club'), to: playerPath(`/clubs/${record.clubId}`, playerId) } : null;
    }
}

function contactOf(club?: ClubDetails) {
    if (club?.whatsappNumber) return { label: 'WhatsApp', href: `https://wa.me/${club.whatsappNumber.replace(/[^+\d]/g, '')}` };
    if (club?.facebookMessengerUrl) return { label: 'Messenger', href: club.facebookMessengerUrl };
    const site = club?.opportunities?.find(item => item.externalLink)?.externalLink;
    return site ? { label: wt('Website'), href: site } : null;
}

/** The selected place: what it is, where and when, and what you can do next. */
export function PlaceDetail({ record, signedIn, canRespond, playerId, onBack, onWalk, onSave, onRespond }: {
    record: PlaceRecord; signedIn: boolean; canRespond: boolean; playerId?: number;
    onBack: () => void; onWalk: () => void; onSave?: () => void; onRespond: () => void;
}) {
    const t = useWorldCopy();
    const { copy, availability } = useAdmissionCopy();
    const club = useWorldData<ClubDetails>(record.clubId ? `map-club:${record.clubId}` : null, signal => apiClient.get<ClubDetails>(`/clubs/${record.clubId}`, { signal }).then(response => response.data));
    const details = club.data;
    const main = destination(record, playerId);
    const located = record.latitude != null && record.longitude != null;
    const contact = contactOf(details);
    const when = record.startsAt && !Number.isNaN(Date.parse(record.startsAt)) ? whenFormat(new Date(record.startsAt)) : null;
    const logo = resolveMediaUrl(record.entityType === 'STADIUM' ? record.logoUrl : details?.logoUrl ?? record.logoUrl);
    const o = record.opportunity;
    const share = () => {
        const url = new URL(window.location.href); url.searchParams.delete('player');
        navigator.share?.({ title: record.title, url: url.toString() }).catch(() => undefined);
    };
    const description = details?.description || (record.entityType !== 'CLUB' ? record.subtitle : null);
    // Opening a place from the list moves focus to it, so keyboard and screen reader users land on what they chose.
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active.closest('.gk-map-panel')) heading.current?.focus({ preventScroll: true });
    }, [record.key]);
    return (
        <article className="gk-map-place" aria-label={record.title} onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onBack(); } }}>
            <div className="gk-map-place__nav"><Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />{t('All results')}</Button></div>
            <header className="gk-map-place__head">
                {record.entityType === 'CLUB' || record.entityType === 'STADIUM' ? <Crest src={logo} name={record.title} size={52} /> : <PlaceLead record={record} />}
                <div className="gk-map-place__titles">
                    <h2 ref={heading} tabIndex={-1}>{record.title}{record.verified && <BadgeCheck className="gk-world-verified" aria-label={t('Verified')} />}</h2>
                    <p>{[typeLabel(record), record.clubName && record.clubName !== record.title ? record.clubName : null].filter(Boolean).join(' · ')}</p>
                    <div className="gk-row gk-map-place__badges">
                        {record.joinPolicy && JOIN[record.joinPolicy] && <Badge tone={record.joinPolicy === 'OPEN_TRIAL' ? 'accent' : 'neutral'}>{t(JOIN[record.joinPolicy])}</Badge>}
                        {record.openChallenge && <Badge tone="warning">{t('Looking for an opponent')}</Badge>}
                        {o && <Badge tone={o.availability === 'WAITLIST' ? 'warning' : 'accent'}>{availability(o.availability)}</Badge>}
                    </div>
                </div>
            </header>
            <div className="gk-map-place__actions">
                {main && <ButtonLink variant="primary" to={main.to}>{main.label}</ButtonLink>}
                {located && <Button onClick={onWalk}><Footprints aria-hidden="true" />{t('Walk here')}</Button>}
                {located && <a className="gk-btn gk-btn--secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${record.latitude},${record.longitude}`} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true" />{t('Directions')}</a>}
                {signedIn && located && onSave && <Button onClick={onSave}><BookmarkPlus aria-hidden="true" />{t('Save to a journey')}</Button>}
                {canRespond && <Button onClick={onRespond}>{t('Respond to this match')}</Button>}
                {contact && <a className="gk-btn gk-btn--ghost" href={contact.href} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />{contact.label}</a>}
                {'share' in navigator && <Button variant="ghost" onClick={share}><Share2 aria-hidden="true" />{t('Share')}</Button>}
            </div>
            <dl className="gk-map-facts">
                {when && <><dt>{t('When')}</dt><dd>{when}</dd></>}
                {(record.address || details?.addressText) && <><dt>{t('Where')}</dt><dd>{record.address || details?.addressText}</dd></>}
                {record.distanceKm != null && <><dt>{t('Distance')}</dt><dd>{t('{distance} away', { distance: distanceLabel(record.distanceKm) ?? '' })}</dd></>}
                {record.fee && <><dt>{t('Cost')}</dt><dd>{record.fee}</dd></>}
                {record.ageGroups.length > 0 && <><dt>{t('Ages')}</dt><dd>{record.ageGroups.join(', ')}</dd></>}
                {o && <><dt>{copy('Born', 'დაბადების წელი')}</dt><dd>{o.birthYearFrom}–{o.birthYearTo} · {o.gender === 'ANY' ? copy('All genders', 'ყველა სქესი') : o.gender === 'MALE' ? copy('Boys / men', 'ბიჭები / კაცები') : copy('Girls / women', 'გოგოები / ქალები')}{o.beginnerWelcome ? ` · ${copy('Beginners welcome', 'დამწყებები მისასალმებელია')}` : ''}</dd></>}
                {o && <><dt>{t('Schedule')}</dt><dd>{o.schedule || copy('Schedule to be agreed', 'განრიგი შესათანხმებელია')}</dd></>}
                {o && <><dt>{t('Fees')}</dt><dd>{!o.terms.feesKnown ? copy('Price to be confirmed', 'ფასი დასაზუსტებელია') : o.terms.charges.length ? o.terms.charges.map(c => `${c.amount} ${c.currency} · ${c.frequency.toLowerCase()}`).join(' + ') : copy('No mandatory charges', 'სავალდებულო გადასახადი არ არის')}</dd></>}
                {details && record.entityType === 'CLUB' && !o && <><dt>{t('People')}</dt><dd>{t('{members} members · {followers} followers', { members: details.memberCount, followers: details.followerCount })}</dd></>}
            </dl>
            {o && <ButtonLink size="sm" variant="ghost" to={playerPath(`/admissions/organizations/${o.organizationId}/inquire?group=${o.id}`, playerId)}>{copy('Ask for group guidance', 'ჯგუფის შესახებ რჩევის კითხვა')}</ButtonLink>}
            {description && <p className="gk-map-place__about">{description}</p>}
            {!o && record.groups && record.groups.length > 0 && (
                <section className="gk-map-place__section" aria-label={t('Training groups')}>
                    <h3>{t('Training groups that fit')}</h3>
                    <List label={t('Training groups')}>
                        {record.groups.map(group => (
                            <ListRow key={group.id} to={playerPath(`/admissions/opportunities/${group.id}`, playerId)} title={group.name}
                                meta={`${group.location.name} · ${availability(group.availability)}`} trail={<ExternalLink aria-hidden="true" />} />
                        ))}
                    </List>
                </section>
            )}
            {details?.trustedByClubs && details.trustedByClubs.length > 0 && (
                <p className="gk-faint">{t('Trusted by {clubs}', { clubs: details.trustedByClubs.map(item => item.clubName).join(', ') })}</p>
            )}
        </article>
    );
}
