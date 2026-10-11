import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, MessageCircle, Plus } from 'lucide-react';
import { EmptyNote } from '../../../design/primitives';
import { get as exchangeGet, type Referee } from '../../matchExchange/api';
import { RoleIcon } from '../../profiles/person/RoleIcon';
import { usePersonProfile } from '../../profiles/person/usePersonProfile';
import { roleLabel } from '../../roles/domain';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { useFollow } from '../directories/people/following';
import { InviteStep } from '../directories/people/InviteStep';
import { refereeLevel } from '../directories/people/peopleWords';
import { positionLabel } from '../directories/people/personData';
import { formatsOf, shortFormat, terms } from '../directories/people/refereeData';
import { fixtureDay } from '../format';
import { useWorldData } from '../useWorldData';
import { useDrawerPlace } from './drawerContext';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { peekClick, peekOf, usePeek } from './usePeek';
import './peek.css';

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
            <h4>{t('Recent matches')}</h4>
            <ul className="gk-peek-list">{referee.match_history!.slice(0, 3).map(match => <li key={match.id}><span className="gk-faint">{fixtureDay(match.starts_at, match.timezone)}</span> {match.title}</li>)}</ul>
        </section>}
    </>;
}

/**
 * A person over World: who they are (every football role they hold, so one person with many roles shows as one),
 * what they do and where, one main action and the way to their full profile. A referee's peek offers to invite them
 * to the match being staffed, when one is chosen.
 */
export default function PersonPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const userId = Number(id);
    const person = usePersonProfile(userId);
    const { side } = useDrawerPlace();
    const drawers = usePeek();
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
    const toggleFollow = () => { void (follow.following !== undefined ? follow.toggle() : person.toggleFollow()).catch(() => undefined); };
    // The full profile: a referee's page for referees, their football profile for everyone else.
    const page = { to: referee ? `/referees/${userId}` : `/profile/${userId}`, label: t('Full profile') };
    return (
        <DrawerFrame title={name} page={page}>
            <header className="gk-peek-person">
                <Crest src={profile.avatarUrl} name={name} size={64} round />
                <div className="gk-peek-person__name">
                    <h3>{name}</h3>
                    <ul className="gk-peek-roles" aria-label={t('Football roles')}>
                        {roles.map(role => <li key={role}><RoleIcon role={role} size="sm" />{t(roleLabel(role))}{role === 'REFEREE' && level && <span className="gk-faint"> · {level}</span>}</li>)}
                    </ul>
                </div>
            </header>
            <div className="gk-peek-actions">
                {!person.own && following !== undefined && <button type="button" className="gk-people-act" data-on={following || undefined} aria-pressed={following} onClick={toggleFollow}>
                    {following ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{following ? t('Following') : t('Follow')}
                </button>}
                {!person.own && <Link className="gk-people-act" to={`/messages?chatWith=${userId}`}><MessageCircle aria-hidden="true" />{t('Message')}</Link>}
            </div>
            {referee && match && refereeProfile.data && !person.own && <InviteStep referee={refereeProfile.data} matchId={match} />}
            {referee && refereeProfile.data && <RefereeFacts referee={refereeProfile.data} />}
            {appointments.length > 0 && <section className="gk-peek-section">
                <h4>{t('Clubs')}</h4>
                <ul className="gk-peek-list">{appointments.map(item => (
                    <li key={`${item.clubId}:${item.title}`} className="gk-peek-club">
                        <Crest src={item.logoUrl} name={item.clubName} size={28} />
                        <span><Link to={`/clubs/${item.clubId}`} onClick={side === 'right' ? peekClick(peekOf('club', item.clubId), drawers.openSide) : undefined}>{item.clubName}</Link><small>{[item.title, item.squads.join(', ')].filter(Boolean).join(' · ')}</small></span>
                    </li>
                ))}</ul>
            </section>}
            {roles.includes('PLAYER') && (profile.position || profile.availabilityStatus) && <div className="gk-peek-facts">
                {profile.position && <Fact label={t('Position')}>{positionLabel(profile.position) ?? profile.position}</Fact>}
                {profile.preferredFoot && <Fact label={t('Foot')}>{t(profile.preferredFoot)}</Fact>}
                {profile.heightCm && <Fact label={t('Height')}>{`${profile.heightCm} cm`}</Fact>}
                {profile.availabilityStatus && <Fact label={t('Status')}>{t(profile.availabilityStatus)}</Fact>}
            </div>}
            {roles.includes('PLAYER') && Boolean(profile.careerHistory?.length) && <section className="gk-peek-section">
                <h4>{t('Seasons')}</h4>
                <ul className="gk-peek-list">{profile.careerHistory!.slice(0, 3).map(season => (
                    <li key={season.id}><span className="gk-faint">{season.season}</span> {season.clubName} · {t('{count} apps', { count: season.appearances })} · {t('{count} goals', { count: season.goals })} · {t('{count} assists', { count: season.assists })}</li>
                ))}</ul>
            </section>}
            {stated.length > 0 && !referee && <Fact label={t('Qualifications, as stated')}>{stated.join(' · ')}</Fact>}
            {Boolean(person.professions?.length) && <section className="gk-peek-section">
                <h4>{t('Work')}</h4>
                <ul className="gk-peek-list">{person.professions!.map(item => (
                    <li key={item.id}>{item.label || item.title}{item.verification === 'CLUB_CONFIRMED' && <span className="gk-peek-check"> · {t('Confirmed by {club}', { club: item.verifiedBy ?? t('a club') })}</span>}</li>
                ))}</ul>
            </section>}
            {profile.bio && !referee && <p className="gk-peek-about">{profile.bio}</p>}
        </DrawerFrame>
    );
}
