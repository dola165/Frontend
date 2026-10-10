import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, Button, ButtonLink, EmptyNote, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { fetchNearbyMap } from '../../../api/map';
import { eventSearch, type EventItem } from '../../requests/api';
import { browseCompetitions } from '../../competitions/api';
import { fetchOpenJobDirectory } from '../../clubs/api';
import { searchTryouts } from '../../tryouts/api';
import { fetchClubDirectory, fetchPeople } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { Crest } from '../Crest';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import { comingWeekend, fixtureDay, fixtureTime, isoDay, isoDayOf, plural } from '../format';
import { CompetitionRow, EventItemRow, JobRow, PersonRow } from '../rows';
import { useWorldData, type WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import { useWorldSession } from '../worldSession';

/** Loading and error states shared by the front-page blocks. */
function BlockState<T>({ data, rows = 3, children }: { data: WorldData<T>; rows?: number; children: (value: T) => ReactNode }) {
    if (data.error) return <div className="gk-notice gk-notice--danger" role="alert"><span className="gk-world-grow">{data.error}</span><Button size="sm" onClick={data.retry}>Try again</Button></div>;
    if (data.data === undefined) return (
        <Panel flush><div role="status" aria-label="Loading">{Array.from({ length: rows }, (_, index) => <div key={index} className="gk-world-skeleton-row"><Skeleton height={36} width={36} /><span><Skeleton height={16} width="45%" /><Skeleton height={12} width="70%" /></span></div>)}</div></Panel>
    );
    return <>{children(data.data)}</>;
}

/**
 * Published matches, competitions and trials near the person, this weekend first. When the
 * weekend is quiet the list continues into the next week, so the block is never a near-empty box.
 * Public training timetables are left to the events search.
 */
export function WeekendBlock({ area }: { area: WorldArea }) {
    const { sessionId } = useAuth();
    const weekend = comingWeekend();
    const until = isoDay(9);
    const events = useWorldData(area.ready ? `weekend:${area.city}:${weekend.from}:${sessionId}` : null,
        signal => eventSearch({ q: '', location: area.city, activity: 'ALL', from: isoDay(0), to: until, page: 0, size: 60 }, sessionId, signal));
    const upcoming = (events.data?.items ?? [])
        // Competitions already under way list their own matches; recurring training is not a fixture.
        .filter((item): item is EventItem & { startsAt: string } => item.kind !== 'SESSION' && item.activity !== 'TRAINING' && Boolean(item.startsAt) && isoDayOf(item.startsAt!) >= isoDay(0))
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const thisWeekend = upcoming.filter(item => isoDayOf(item.startsAt) >= weekend.from && isoDayOf(item.startsAt) <= weekend.to);
    const quiet = thisWeekend.length < 4;
    const shown = (quiet ? upcoming : thisWeekend).slice(0, 7);
    const from = quiet ? isoDay(0) : weekend.from, to = quiet ? until : weekend.to;
    const all = `/world/matches?tab=events&location=${encodeURIComponent(area.city)}&from=${from}&to=${to}`;
    return (
        <Section id="world-weekend" title={quiet ? 'Coming up near you' : 'This weekend near you'} hint={quiet ? 'Next 10 days' : weekend.label} action={{ label: 'All events', to: all }}>
            <BlockState data={events} rows={5}>{() => shown.length ? (
                <Panel flush>
                    <List label={quiet ? 'Coming up near you' : 'This weekend near you'}>
                        {shown.map(item => <EventItemRow key={`${item.kind}:${item.id}`} item={item} />)}
                    </List>
                    {upcoming.length > shown.length && <div className="gk-panel__foot"><ButtonLink size="sm" variant="ghost" to={all}>See {plural(upcoming.length - shown.length, 'more event')}</ButtonLink></div>}
                </Panel>
            ) : (
                <Panel><EmptyNote title={`Nothing published near ${area.city} in the next 10 days`} action={<ButtonLink size="sm" to="/world/matches">Browse matches</ButtonLink>}>Clubs and organisers publish matches, trials and competitions here.</EmptyNote></Panel>
            )}</BlockState>
        </Section>
    );
}

/** A compact map of clubs and venues around the area, with the way into the full map. */
export function AroundMapBlock({ area }: { area: WorldArea }) {
    const markers = useWorldData(area.centre ? `around:${area.city}:${area.centre.lat}` : null,
        signal => fetchNearbyMap({ lat: area.centre!.lat, lng: area.centre!.lng, radius: 25, type: ['CLUB', 'STADIUM'], size: 100 }, signal));
    const points: WorldMapPoint[] = (markers.data?.content ?? []).map(marker => ({
        id: `${marker.entityType}:${marker.entityId}`, lat: marker.latitude, lng: marker.longitude, label: marker.title,
        meta: marker.entityType === 'CLUB' ? [marker.subtitle, marker.addressText].filter(Boolean).join(' · ') : [marker.subtitle, marker.fee].filter(Boolean).join(' · '),
        tone: marker.entityType === 'CLUB' ? 'club' : 'venue',
        to: marker.entityType === 'CLUB' ? `/clubs/${marker.clubId ?? marker.entityId}` : `/stadiums/${marker.entityId}`,
    }));
    const clubs = points.filter(point => point.tone === 'club').length;
    return (
        <Section id="world-around" title={`Around ${area.city}`} action={{ label: 'Open full map', to: '/world/map' }}>
            {markers.error
                ? <div className="gk-notice gk-notice--danger" role="alert"><span className="gk-world-grow">{markers.error}</span><Button size="sm" onClick={markers.retry}>Try again</Button></div>
                : <WorldMap className="gk-world-front__map" label={`Clubs and venues around ${area.city}`} points={points}
                    footer={markers.data ? <span>{plural(clubs, 'club')} and {plural(points.length - clubs, 'venue')} within 25 km</span> : <span>Finding clubs and venues…</span>} />}
        </Section>
    );
}

/** A few clubs in the area, as cards with Follow and Open. The person's own club is left out. */
export function NearbyClubsBlock({ area }: { area: WorldArea }) {
    const { membership } = useWorldSession();
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    const clubs = useWorldData(area.ready ? `near-clubs:${area.city}:${ownClub}` : null,
        signal => fetchClubDirectory(new URLSearchParams({ city: area.city, sort: 'MEMBER_COUNT', page: '0', size: '5' }), signal));
    return (
        <Section id="world-clubs" title="Clubs near you" hint={area.city} action={{ label: 'All clubs', to: `/world/clubs?city=${encodeURIComponent(area.city)}` }}>
            <BlockState data={clubs} rows={2}>{page => {
                const list = page.content.filter(club => club.id !== ownClub).slice(0, 4);
                return list.length
                    ? <div className="gk-world-front__clubs">{list.map(club => <ClubCard key={club.id} club={club} compact />)}</div>
                    : <Panel><EmptyNote title={`No clubs listed in ${area.city} yet`} action={<ButtonLink size="sm" to="/world/clubs">Browse all clubs</ButtonLink>}>Try another area or browse every club.</EmptyNote></Panel>;
            }}</BlockState>
        </Section>
    );
}

/** Competitions taking entries now, soonest first. */
export function OpenCompetitionsBlock() {
    const competitions = useWorldData('open-competitions', signal => browseCompetitions(new URLSearchParams({ registration: 'OPEN', page: '0', size: '4' }), signal));
    return (
        <Section id="world-competitions" title="Open for entries" action={{ label: 'All competitions', to: '/world/competitions?registration=OPEN' }}>
            <BlockState data={competitions}>{page => page.content.length
                ? <Panel flush><List label="Open for entries">{page.content.map(card => <CompetitionRow key={card.id} card={card} compact />)}</List></Panel>
                : <Panel><EmptyNote title="No competitions are taking entries" action={<ButtonLink size="sm" to="/world/competitions">Browse competitions</ButtonLink>}>New leagues and cups appear here when entries open.</EmptyNote></Panel>}
            </BlockState>
        </Section>
    );
}

/** Newest club roles and the next open trials. */
export function OpportunitiesBlock({ area }: { area: WorldArea }) {
    const data = useWorldData(area.ready ? `front-opportunities:${area.city}` : null, async signal => {
        const [jobs, trials] = await Promise.all([fetchOpenJobDirectory(signal), searchTryouts({ status: 'OPEN', page: 0, size: 2 }, signal)]);
        return { jobs: jobs.slice(0, 3), trials: trials.items, trialTotal: trials.total };
    });
    return (
        <Section id="world-opportunities" title="Opportunities" action={{ label: 'All opportunities', to: '/world/opportunities' }}>
            <BlockState data={data}>{({ jobs, trials }) => jobs.length || trials.length ? (
                <Panel flush>
                    <List label="Opportunities">
                        {trials.map(trial => <ListRow key={`t${trial.id}`} to={`/tryouts/${trial.id}`} lead={<Crest name={trial.clubName} size={36} />} title={trial.title}
                            meta={[trial.clubName, trial.tryoutDate && `${fixtureDay(trial.tryoutDate)} ${fixtureTime(trial.tryoutDate)}`, trial.ageGroup].filter(Boolean).join(' · ')} trail={<Badge tone="warning">Trial</Badge>} />)}
                        {jobs.map(job => <JobRow key={`j${job.id}`} job={job} compact />)}
                    </List>
                </Panel>
            ) : <Panel><EmptyNote title="No open roles or trials right now">Clubs post jobs, volunteering and trials here.</EmptyNote></Panel>}
            </BlockState>
        </Section>
    );
}

/** Coaches, referees and specialists in the area, from outside the person's own club. */
export function PeopleBlock({ area }: { area: WorldArea }) {
    const { status, sessionId, user } = useAuth();
    const { membership } = useWorldSession();
    const location = useLocation();
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    const people = useWorldData(status === 'authenticated' && area.ready ? `people-to-know:${area.city}:${sessionId}` : null,
        signal => fetchPeople({ city: area.city, size: 12 }, sessionId, signal));
    return (
        <Section id="world-people" title="People to know" action={status === 'authenticated' ? { label: 'All people', to: '/world/people' } : undefined}>
            {status !== 'authenticated'
                ? <Panel><EmptyNote title="Coaches, referees and specialists" action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>Sign in</ButtonLink>}>Sign in to find people by role, profession and area.</EmptyNote></Panel>
                : <BlockState data={people}>{page => {
                    const list = page.items.filter(person => person.id !== user?.id && person.clubId !== ownClub && person.role !== 'PLAYER').slice(0, 5);
                    return list.length
                        ? <Panel flush><List label="People to know">{list.map(person => <PersonRow key={person.id} person={person} compact />)}</List></Panel>
                        : <Panel><EmptyNote title={`No public profiles in ${area.city} yet`} action={<ButtonLink size="sm" to="/world/people">Browse people</ButtonLink>} /></Panel>;
                }}</BlockState>}
        </Section>
    );
}
