import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, PenLine, Shirt, Trophy } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ButtonLink, EmptyNote, FixtureRow, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { dayLabel, eventKind, timeLabel } from '../../clubWorkspace/fixtures';
import type { ScheduleEventOccurrence } from '../../schedule/api';
import { overviewFixtures, overviewLead, overviewProgrammes } from '../overviewPolicy';
import { money, programmeAge, programmePrice } from '../presentation';
import { staffTitle, trainingPath, type PublicSquad, type PublicStaff } from '../publicJourney';
import type { PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import { useOverviewSource } from '../useOverviewSource';
import { ProfilePosts } from '../../profiles/ProfilePosts';
import { useProfilePostFeed } from '../../profiles/useProfilePostFeed';
import { ClubFamilyWeek } from './ClubFamilyWeek';
import type { ClubPermissions } from './useClubProfile';
import type { ClubProfile } from './types';

type Source<T> = ReturnType<typeof useOverviewSource<T>>;
const tabLink = (club: number, tab: string) => `/clubs/${club}?tab=${tab}`;

/**
 * The club's front page, read like a page people know from Facebook: the latest posts first,
 * a clear way to follow or join, then what is coming up, training and the people and places.
 */
export function ClubOverviewTab({ club, can, onFollow, onJoin }: { club: ClubProfile; can: ClubPermissions; onFollow: () => void; onJoin: () => void }) {
    const { user } = useAuth();
    const feed = useProfilePostFeed(`/posts/club/${club.id}`, 3);
    const lead = overviewLead(club.id, user?.role, user?.navigationCapabilities);
    const [window] = useState(() => {
        const start = new Date(), end = new Date(start); end.setDate(end.getDate() + 30);
        const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
        return `from=${local(start)}&to=${local(end)}`;
    });
    const schedule = useOverviewSource<{ events: ScheduleEventOccurrence[] }>(`/schedule/clubs/${club.id}/events?${window}`);
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    const people = useOverviewSource<PublicStaff[]>(`/clubs/${club.id}/staff-directory`);
    const newcomer = !can.connected && !can.own && !club.isFollowedByMe;
    // Another club's staff are offered a match in the header; joining is for players and families.
    const join = can.canJoin && !can.canChallenge;

    return <>
        {lead === 'family' && <ClubFamilyWeek clubId={club.id} />}
        <Section title="Latest posts" action={can.canPost ? <Link className="gk-section__action gk-row" to={tabLink(club.id, 'posts')}><PenLine size={15} aria-hidden="true" />Write a post</Link> : undefined}>
            <ProfilePosts feed={feed} preview={{ count: 2, allTo: tabLink(club.id, 'posts') }}
                empty={{ title: 'No posts yet', body: can.canPost ? 'Share the first update from the Posts tab. It appears here and in your followers’ Home feed.' : 'When the club shares news, photos and results, they appear here.' }} />
        </Section>
        {newcomer && <Panel padded className="gk-club-call">
            <div className="gk-club-call__text">
                <h2>Keep up with {club.name}</h2>
                <p>Follow to see their posts, results and news in your Home feed.{join ? ' Want to play or train here? See the groups, fees and how to join.' : ''}</p>
            </div>
            <div className="gk-row gk-club-call__actions">
                {can.canFollow && <Button variant={join ? 'secondary' : 'primary'} onClick={onFollow}>Follow</Button>}
                {join && <Button variant="primary" onClick={onJoin}>See how to join</Button>}
            </div>
        </Panel>}
        <Section title="Coming up" hint="Next 30 days" action={{ label: 'Full schedule', to: tabLink(club.id, 'schedule') }}>
            <Fixtures club={club} source={schedule} />
        </Section>
        <Training club={club} can={can} onJoin={onJoin} />
        <div className="gk-club-overview-grid">
            <Venues club={club} source={places} />
            <Staff club={club} source={people} />
            <Honours club={club} />
        </div>
    </>;
}

function Fixtures({ club, source }: { club: ClubProfile; source: Source<{ events: ScheduleEventOccurrence[] }> }) {
    const fixtures = overviewFixtures(source.data?.events ?? []).slice(0, 4);
    if (source.loading) return <Panel flush><div className="gk-panel--pad"><Skeleton height={56} /></div></Panel>;
    if (source.failed) return <Panel flush><EmptyNote title="The schedule couldn’t load" action={<Button size="sm" onClick={source.retry}>Try again</Button>} /></Panel>;
    if (!fixtures.length) return <Panel flush><EmptyNote title="No public matches in the next 30 days" action={<ButtonLink size="sm" to={tabLink(club.id, 'schedule')}>Open the schedule</ButtonLink>}>Training and club events are in the schedule.</EmptyNote></Panel>;
    return <Panel flush><List label="Upcoming matches">{fixtures.map(f => {
        const squad = f.clubId === club.id ? f.challengerSquadName : f.targetSquadName;
        const kind = eventKind[f.eventType] ?? eventKind.MATCH;
        return <FixtureRow key={`${f.occurrenceId}:${f.startsAt}`} tone={kind.tone} time={timeLabel(f.startsAt)} day={dayLabel(f.startsAt)} title={f.title}
            to={f.matchExchangeId ? `/match-exchange/${f.matchExchangeId}` : tabLink(club.id, 'schedule')}
            meta={[squad, f.locationName].filter(Boolean).join(' · ')}
            trail={f.challengeStatus && f.challengeStatus !== 'ACCEPTED' ? <Badge tone="warning">Awaiting confirmation</Badge> : <Badge tone={kind.badge}>{kind.label}</Badge>} />;
    })}</List></Panel>;
}

function Training({ club, can, onJoin }: { club: ClubProfile; can: ClubPermissions; onJoin: () => void }) {
    const programmes = overviewProgrammes(club.presentation?.programmes);
    const squads = useOverviewSource<PublicSquad[]>(`/clubs/${club.id}/squads`);
    const foot = can.canJoin && !can.canChallenge ? <div className="gk-row gk-club-training-foot"><span className="gk-muted">Choose a group to see its timetable, then arrange a first visit or ask the club.</span><Button variant="primary" size="sm" onClick={onJoin}>See how to join</Button></div> : undefined;
    return <Section title="Squads and training" action={{ label: 'All squads and training', to: tabLink(club.id, 'teams') }}>
        <Panel flush footer={foot}>
            {programmes.length ? <List label="Training programmes" className="gk-club-programmes">{programmes.slice(0, 4).map((p, i) => <ListRow key={p.id ?? i} to={trainingPath(club.id, { programme: p.id })}
                title={p.name}
                meta={[programmeAge(p), p.sessionsPerWeek ? `${p.sessionsPerWeek} ${p.sessionsPerWeek === 1 ? 'session' : 'sessions'} a week` : null, p.trialAmount != null ? `Trial ${Number(p.trialAmount) === 0 ? 'free' : money(p.trialAmount, p.currency)}` : null].filter(Boolean).join(' · ')}
                trail={<span className="gk-club-price gk-num">{programmePrice(p)}</span>} />)}</List>
                : squads.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : squads.data?.length ? <List label="Squads">{squads.data.slice(0, 6).map(squad => <ListRow key={squad.id} to={trainingPath(club.id, { squad: squad.id })}
                    lead={<span className="gk-club-icon"><Shirt aria-hidden="true" /></span>} title={squad.name} meta={[squad.category, squad.gender ? squad.gender.toLowerCase().replace(/^./, c => c.toUpperCase()) : null].filter(Boolean).join(' · ')} />)}</List>
                : <EmptyNote title="Training fees aren’t published yet" action={<ButtonLink size="sm" to={tabLink(club.id, 'teams')}>See the squads</ButtonLink>}>Ask the club about age groups, training times and fees.</EmptyNote>}
        </Panel>
    </Section>;
}

function Venues({ club, source }: { club: ClubProfile; source: Source<PublicFacility[]> }) {
    const venues = (source.data ?? []).filter(place => placeType(place) !== 'FACILITY');
    return <Section title="Venues" action={{ label: 'All venues', to: tabLink(club.id, 'facilities') }}>
        <Panel flush>{source.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
            : source.failed ? <EmptyNote title="Venues couldn’t load" action={<Button size="sm" onClick={source.retry}>Try again</Button>} />
            : venues.length ? <List label="Venues">{venues.slice(0, 3).map(v => <ListRow key={v.id} to={tabLink(club.id, 'facilities')}
                lead={<span className="gk-club-icon"><MapPin aria-hidden="true" /></span>} title={v.title} meta={v.details.address || v.linkedVenue?.address || v.squadName || 'Address on the venue page'} />)}</List>
            : <EmptyNote title="No venues published yet" />}</Panel>
    </Section>;
}

function Staff({ club, source }: { club: ClubProfile; source: Source<PublicStaff[]> }) {
    return <Section title="Coaches and staff" action={{ label: 'Meet the team', to: tabLink(club.id, 'people') }}>
        <Panel flush>{source.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
            : source.failed ? <EmptyNote title="Staff couldn’t load" action={<Button size="sm" onClick={source.retry}>Try again</Button>} />
            : source.data?.length ? <List label="Coaches and staff">{source.data.slice(0, 4).map(p => <ListRow key={p.userId} to={`/profile/${p.userId}`}
                lead={<Crest src={p.avatarUrl} name={p.fullName} size={36} round />} title={p.fullName} meta={staffTitle(p)} />)}</List>
            : <EmptyNote title="No staff published yet" />}</Panel>
    </Section>;
}

function Honours({ club }: { club: ClubProfile }) {
    const honours = [...(club.honours ?? [])].sort((a, b) => b.yearWon - a.yearWon);
    return <Section title="Honours" action={honours.length > 3 ? { label: 'All honours', to: tabLink(club.id, 'honours') } : undefined}>
        <Panel flush>{honours.length ? <List label="Honours">{honours.slice(0, 3).map(h => <ListRow key={h.id}
            lead={<span className="gk-club-icon gk-club-icon--warning"><Trophy aria-hidden="true" /></span>} title={h.title} meta={String(h.yearWon)} />)}</List>
            : <EmptyNote title="No honours recorded yet" />}</Panel>
    </Section>;
}
