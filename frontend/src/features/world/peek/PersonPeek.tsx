import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { FollowButton } from '../../actions/FollowButton';
import { EmptyNote } from '../../../design/primitives';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { get as exchangeGet, type Referee } from '../../matchExchange/api';
import { RoleIcon } from '../../profiles/person/RoleIcon';
import { usePersonProfile } from '../../profiles/person/usePersonProfile';
import { isProfessionalRole, roleLabel } from '../../roles/domain';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { useFollow } from '../directories/people/following';
import { InvitePick, InviteStep } from '../directories/people/InviteStep';
import { refereeLevel } from '../directories/people/peopleWords';
import { positionLabel } from '../directories/people/personData';
import { formatsOf, shortFormat, terms } from '../directories/people/refereeData';
import { fixtureDay } from '../format';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { PersonCareer } from './PersonCareer';
import { peekClick, peekOf, useRelatedOpen } from './usePeek';
import './peek.css';
import './pane.css';

/** One fact as a short label over its value. */
const Fact = ({ label, children }: { label: string; children: ReactNode }) => <div className="gk-peek-fact"><span>{label}</span><b>{children}</b></div>;

/** A referee's side: their terms, formats, area and languages, a few words about them, and recent matches. */
function RefereeFacts({ referee }: { referee: Referee }) {
    const t = useWorldCopy();
    return <>
        <div className="gk-peek-facts">
            <Fact label={t('Terms')}>{terms(referee)}</Fact>
            <Fact label={t('Formats')}>{formatsOf(referee).map(shortFormat).join(' · ')}</Fact>
            <Fact label={t('Area, as stated')}>{[referee.service_area, referee.travel_km ? t('up to {km} km', { km: referee.travel_km }) : null].filter(Boolean).join(' · ')}</Fact>
            {referee.languages && <Fact label={t('Languages')}>{referee.languages}</Fact>}
        </div>
        {referee.biography && <p className="gk-peek-about">{referee.biography}</p>}
        {Boolean(referee.match_history?.length) && <section className="gk-peek-section">
            <h3 className="gk-peek-section__title">{t('Recent matches')}</h3>
            <ul className="gk-peek-list">{referee.match_history!.slice(0, 3).map(match => <li key={match.id}><span className="gk-faint">{fixtureDay(match.starts_at, match.timezone)}</span> {match.title}</li>)}</ul>
        </section>}
    </>;
}

/**
 * A person beside the list (or in a drawer): their cover and face, who they are (every football role they hold, so one
 * person with many roles shows as one), their clubs (each opens over them) and their career as they published it, with
 * "View career" and their full profile. A referee's offers to invite them to the match being staffed, when one is chosen.
 */
export default function PersonPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const userId = Number(id);
    const person = usePersonProfile(userId);
    const relate = useRelatedOpen();
    const [params] = useSearchParams();
    const follow = useFollow(userId);
    const { profile, roles } = person;
    const referee = roles.includes('REFEREE');
    const refereeProfile = useWorldData(referee ? `referee:${userId}` : null, signal => exchangeGet<Referee>(`/referees/${userId}`, undefined, signal));
    const match = /^[1-9]\d*$/.test(params.get('match') ?? '') ? Number(params.get('match')) : null;
    const name = profile?.fullName || profile?.username || t('Profile');

    if (person.status === 'loading') return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (person.status !== 'ready' || !profile) return (
        <DrawerFrame title={t('Profile')}><EmptyNote title={person.status === 'missing' ? t('Profile not found') : t('This profile could not load.')} /></DrawerFrame>
    );
    if (person.hidden || person.possibleMinor) return <DrawerFrame title={name}><EmptyNote title={t('This profile is not public.')} /></DrawerFrame>;

    const appointments = profile.footballProfile?.appointments ?? [];
    const stated = (profile.roleProfiles ?? []).map(role => role.qualifications).filter((value): value is string => Boolean(value));
    const level = referee ? refereeLevel(refereeProfile.data?.qualifications) : null;
    const following = follow.following ?? (person.own ? undefined : profile.isFollowedByMe);
    // The page's own list of who is followed and the profile both learn the change.
    const followChanged = (next: boolean) => { if (follow.following !== undefined) follow.set(next); person.followChanged(next); };
    // Their profile is public to everyone; its Career tab exists for football roles (a referee's career is there).
    const career = roles.some(isProfessionalRole) ? `/profile/${userId}?tab=career` : undefined;
    const headline = (profile.roleProfiles ?? []).find(role => role.headline)?.headline;
    const cover = resolveMediaUrl(profile.bannerUrl);
    return (
        <DrawerFrame title={name} page={{ to: `/profile/${userId}`, label: t('Full profile') }}>
            <div className="gk-pane-top">
                <div className="gk-pane-cover">{cover && <MediaImage src={cover} alt="" />}</div>
                <header className="gk-pane-head gk-pane-head--person">
                    <Crest src={profile.avatarUrl} name={name} size={64} round />
                    <div>
                        <h3>{name}</h3>
                        <ul className="gk-peek-roles" aria-label={t('Football roles')}>
                            {roles.map(role => <li key={role}><RoleIcon role={role} size="sm" />{t(roleLabel(role))}{role === 'REFEREE' && level && <span className="gk-faint"> · {level}</span>}</li>)}
                        </ul>
                        {headline && <p>{headline}</p>}
                    </div>
                </header>
            </div>
            <div className="gk-peek-actions">
                {!person.own && <FollowButton look="chip" subject={{ kind: 'person', id: userId }} following={following} name={name} onChange={followChanged} />}
                {!person.own && <Link className="gk-people-act" to={`/messages?chatWith=${userId}`}><MessageCircle aria-hidden="true" />{t('Message')}</Link>}
            </div>
            {referee && refereeProfile.data && !person.own && (match ? <InviteStep referee={refereeProfile.data} matchId={match} /> : <InvitePick referee={refereeProfile.data} />)}
            {referee && refereeProfile.data && <RefereeFacts referee={refereeProfile.data} />}
            {appointments.length > 0 && <section className="gk-peek-section">
                <h3 className="gk-peek-section__title">{t('Clubs')}</h3>
                <ul className="gk-peek-list">{appointments.map(item => (
                    <li key={`${item.clubId}:${item.title}`} className="gk-peek-club">
                        <Crest src={item.logoUrl} name={item.clubName} size={28} />
                        <span><Link to={`/clubs/${item.clubId}`} onClick={peekClick(peekOf('club', item.clubId), relate)}>{item.clubName}</Link><small>{[item.title, item.squads.join(', '), item.memberSince ? t('since {year}', { year: item.memberSince.slice(0, 4) }) : null].filter(Boolean).join(' · ')}</small></span>
                    </li>
                ))}</ul>
            </section>}
            <PersonCareer entries={profile.footballProfile?.entries ?? []} link={career} />
            {roles.includes('PLAYER') && (profile.position || profile.availabilityStatus) && <div className="gk-peek-facts">
                {profile.position && <Fact label={t('Position')}>{positionLabel(profile.position) ?? profile.position}</Fact>}
                {profile.preferredFoot && <Fact label={t('Foot')}>{t(profile.preferredFoot)}</Fact>}
                {profile.heightCm && <Fact label={t('Height')}>{`${profile.heightCm} cm`}</Fact>}
                {profile.availabilityStatus && <Fact label={t('Status')}>{t(profile.availabilityStatus)}</Fact>}
            </div>}
            {roles.includes('PLAYER') && Boolean(profile.careerHistory?.length) && <section className="gk-peek-section">
                <h3 className="gk-peek-section__title">{t('Seasons')}</h3>
                <ul className="gk-peek-list">{profile.careerHistory!.slice(0, 3).map(season => (
                    <li key={season.id}><span className="gk-faint">{season.season}</span> {season.clubName} · {t('{count} apps', { count: season.appearances })} · {t('{count} goals', { count: season.goals })} · {t('{count} assists', { count: season.assists })}</li>
                ))}</ul>
            </section>}
            {stated.length > 0 && !referee && <Fact label={t('Qualifications, as stated')}>{stated.join(' · ')}</Fact>}
            {Boolean(person.professions?.length) && <section className="gk-peek-section">
                <h3 className="gk-peek-section__title">{t('Work')}</h3>
                <ul className="gk-peek-list">{person.professions!.map(item => (
                    <li key={item.id}>{item.label || item.title}{item.verification === 'CLUB_CONFIRMED' && <span className="gk-peek-check"> · {t('Confirmed by {club}', { club: item.verifiedBy ?? t('a club') })}</span>}</li>
                ))}</ul>
            </section>}
            {profile.bio && !referee && profile.bio !== headline && <p className="gk-peek-about">{profile.bio}</p>}
        </DrawerFrame>
    );
}
