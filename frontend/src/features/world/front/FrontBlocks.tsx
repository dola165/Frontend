import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Badge, ButtonLink, EmptyNote, List, ListRow, Panel, Section } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import type { MapPageResult } from '../../../api/map';
import { eventSearch, type EventItem } from '../../requests/api';
import { browseCompetitions } from '../../competitions/api';
import { fetchOpenJobDirectory } from '../../clubs/api';
import { searchTryouts } from '../../tryouts/api';
import { fetchClubDirectory, fetchPeople } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ErrorNote, SkeletonRows } from '../directory/DirectoryResults';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import { codeLabel, comingWeekend, fixtureDay, fixtureTime, isoDay, isoDayOf } from '../format';
import { ageOn, useWorldChild } from '../players';
import { CompetitionRow, EventItemRow, JobRow, PersonRow } from '../rows';
import { useWorldData, type WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import { useWorldSession } from '../worldSession';

/** Loading and error states shared by the front-page blocks. */
function BlockState<T>({ data, rows = 3, children }: { data: WorldData<T>; rows?: number; children: (value: T) => ReactNode }) {
    const t = useWorldCopy();
    if (data.error) return <ErrorNote message={data.error} onRetry={data.retry} />;
    if (data.data === undefined) return <Panel flush><SkeletonRows count={rows} label={t('Loading')} /></Panel>;
    return <>{children(data.data)}</>;
}

/**
 * Published matches, competitions and trials near the person, this weekend first. When the
 * weekend is quiet the list continues into the next week, so the block is never a near-empty box.
 * Public training timetables are left to the events search.
 */
export function WeekendBlock({ area }: { area: WorldArea }) {
    const t = useWorldCopy();
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
    const title = quiet ? t('Coming up near you') : t('This weekend near you');
    return (
        <Section id="world-weekend" title={title} hint={quiet ? t('Next 10 days') : weekend.label} action={{ label: t('All events'), to: all }}>
            <BlockState data={events} rows={5}>{() => shown.length ? (
                <Panel flush>
                    <List label={title}>
                        {shown.map(item => <EventItemRow key={`${item.kind}:${item.id}`} item={item} />)}
                    </List>
                    {upcoming.length > shown.length && <div className="gk-panel__foot"><ButtonLink size="sm" variant="ghost" to={all}>{t('See {count} more', { count: upcoming.length - shown.length })}</ButtonLink></div>}
                </Panel>
            ) : (
                <Panel><EmptyNote title={t('Nothing published near {city} in the next 10 days', { city: area.city })} action={<ButtonLink size="sm" to="/world/matches">{t('Browse matches')}</ButtonLink>}>{t('Clubs and organisers publish matches, trials and competitions here.')}</EmptyNote></Panel>
            )}</BlockState>
        </Section>
    );
}

/** A compact map of clubs and venues around the area, with the way into the full map. */
export function AroundMapBlock({ area, markers }: { area: WorldArea; markers: WorldData<MapPageResult> }) {
    const t = useWorldCopy();
    const points: WorldMapPoint[] = (markers.data?.content ?? []).map(marker => ({
        id: `${marker.entityType}:${marker.entityId}`, lat: marker.latitude, lng: marker.longitude, label: marker.title,
        meta: marker.entityType === 'CLUB' ? [marker.subtitle, marker.addressText].filter(Boolean).join(' · ') : [marker.subtitle, marker.fee].filter(Boolean).join(' · '),
        tone: marker.entityType === 'CLUB' ? 'club' : 'venue',
        to: marker.entityType === 'CLUB' ? `/clubs/${marker.clubId ?? marker.entityId}` : `/stadiums/${marker.entityId}`,
    }));
    // Clubs usually sit at a venue; draw them last so they are not hidden under it.
    points.sort((a, b) => Number(a.tone === 'club') - Number(b.tone === 'club'));
    const clubs = points.filter(point => point.tone === 'club').length;
    return (
        <Section id="world-around" title={t('Around {city}', { city: area.city })} action={{ label: t('Open full map'), to: `/world/map?region=${encodeURIComponent(area.city)}` }}>
            {markers.error
                ? <ErrorNote message={markers.error} onRetry={markers.retry} />
                : <WorldMap className="gk-world-front__map" label={t('Clubs and venues around {city}', { city: area.city })} points={points}
                    footer={markers.data ? <span>{t('{clubs} and {venues} within 25 km', { clubs: plural(clubs, 'club'), venues: plural(points.length - clubs, 'venue') })}</span> : <span>{t('Finding clubs and venues…')}</span>} />}
        </Section>
    );
}

/**
 * A few clubs in the area, as cards with Follow and Open. The person's own club is left out.
 * For a parent searching for a child, only clubs with a programme for the child's age are asked for.
 */
export function NearbyClubsBlock({ area, markers }: { area: WorldArea; markers: WorldData<MapPageResult> }) {
    const t = useWorldCopy();
    const { membership } = useWorldSession();
    const { child } = useWorldChild();
    const age = ageOn(child?.dateOfBirth);
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    // Wait for the person's club so it can be left out without loading the list twice.
    const clubs = useWorldData(area.ready && membership !== undefined ? `near-clubs:${area.city}:${ownClub}:${age ?? ''}` : null, signal => {
        const params = new URLSearchParams({ city: area.city, sort: 'MEMBER_COUNT', page: '0', size: '12' });
        // Backend needed: `age` keeps clubs with a published programme for that age (see clubSources).
        if (age != null) params.set('age', String(age));
        return fetchClubDirectory(params, signal);
    });
    // Distance comes from the map search around the area's centre; clubs it cannot place keep their order.
    const distance = new Map((markers.data?.content ?? []).filter(marker => marker.entityType === 'CLUB').map(marker => [marker.clubId ?? marker.entityId, marker.distanceKm]));
    const far = Number.POSITIVE_INFINITY;
    const all = `/world/clubs?city=${encodeURIComponent(area.city)}${child ? `&player=${child.id}` : ''}`;
    return (
        <Section id="world-clubs" title={child ? t('Clubs near you for {name}', { name: child.name }) : t('Clubs near you')} hint={area.city} action={{ label: t('All clubs'), to: all }}>
            <BlockState data={clubs} rows={2}>{page => {
                const list = page.content.filter(club => club.id !== ownClub)
                    .sort((a, b) => (distance.get(a.id) ?? far) - (distance.get(b.id) ?? far)).slice(0, 4);
                return list.length
                    ? <div className="gk-world-front__clubs">{list.map(club => <ClubCard key={club.id} club={club} distanceKm={distance.get(club.id)} compact />)}</div>
                    : <Panel><EmptyNote title={t('No clubs listed in {city} yet', { city: area.city })} action={<ButtonLink size="sm" to="/world/clubs">{t('Browse all clubs')}</ButtonLink>}>{t('Try another area or browse every club.')}</EmptyNote></Panel>;
            }}</BlockState>
        </Section>
    );
}

/** Competitions taking entries now, soonest first. */
export function OpenCompetitionsBlock() {
    const t = useWorldCopy();
    const competitions = useWorldData('open-competitions', signal => browseCompetitions(new URLSearchParams({ registration: 'OPEN', page: '0', size: '4' }), signal));
    return (
        <Section id="world-competitions" title={t('Open for entries')} action={{ label: t('All competitions'), to: '/world/competitions?registration=OPEN' }}>
            <BlockState data={competitions}>{page => page.content.length
                ? <Panel flush><List label={t('Open for entries')}>{page.content.map(card => <CompetitionRow key={card.id} card={card} compact />)}</List></Panel>
                : <Panel><EmptyNote title={t('No competitions are taking entries')} action={<ButtonLink size="sm" to="/world/competitions">{t('Browse competitions')}</ButtonLink>}>{t('New leagues and cups appear here when entries open.')}</EmptyNote></Panel>}
            </BlockState>
        </Section>
    );
}

/** Newest club roles and the next open trials. */
export function OpportunitiesBlock({ area }: { area: WorldArea }) {
    const t = useWorldCopy();
    const data = useWorldData(area.ready ? `front-opportunities:${area.city}` : null, async signal => {
        const [jobs, trials] = await Promise.all([fetchOpenJobDirectory(signal), searchTryouts({ status: 'OPEN', page: 0, size: 2 }, signal)]);
        return { jobs: jobs.slice(0, 3), trials: trials.items, trialTotal: trials.total };
    });
    return (
        <Section id="world-opportunities" title={t('Opportunities')} action={{ label: t('All opportunities'), to: '/world/opportunities' }}>
            <BlockState data={data}>{({ jobs, trials }) => jobs.length || trials.length ? (
                <Panel flush>
                    <List label={t('Opportunities')}>
                        {trials.map(trial => <ListRow key={`t${trial.id}`} to={`/tryouts/${trial.id}`} lead={<Crest name={trial.clubName} size={36} />} title={trial.title}
                            meta={[trial.clubName, trial.tryoutDate && `${fixtureDay(trial.tryoutDate)} ${fixtureTime(trial.tryoutDate)}`, codeLabel(trial.ageGroup)].filter(Boolean).join(' · ')} trail={<Badge tone="warning">{t('Trial')}</Badge>} />)}
                        {jobs.map(job => <JobRow key={`j${job.id}`} job={job} compact />)}
                    </List>
                </Panel>
            ) : <Panel><EmptyNote title={t('No open roles or trials right now')}>{t('Clubs post jobs, volunteering and trials here.')}</EmptyNote></Panel>}
            </BlockState>
        </Section>
    );
}

/**
 * Coaches, referees and specialists in the area, from outside the person's own club. Without the
 * people directory on the server, people can only be found by name, and the block says so.
 */
export function PeopleBlock({ area }: { area: WorldArea }) {
    const t = useWorldCopy();
    const { status, sessionId, user } = useAuth();
    const { membership } = useWorldSession();
    const location = useLocation();
    const ownClub = membership?.clubId ? Number(membership.clubId) : null;
    const people = useWorldData(status === 'authenticated' && area.ready ? `people-to-know:${area.city}:${sessionId}` : null,
        signal => fetchPeople({ city: area.city, size: 12 }, sessionId, signal));
    return (
        <Section id="world-people" title={t('People to know')} action={status === 'authenticated' ? { label: t('All people'), to: '/world/people' } : undefined}>
            {status !== 'authenticated'
                ? <Panel><EmptyNote title={t('Coaches, referees and specialists')} action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>}>{t('Sign in to find people by role, profession and area.')}</EmptyNote></Panel>
                : <BlockState data={people}>{page => {
                    if (page.searchOnly) return <Panel><EmptyNote title={t('Find people by name')} action={<ButtonLink size="sm" to="/world/people">{t('Search people')}</ButtonLink>}>{t('Search coaches, referees and specialists by name.')}</EmptyNote></Panel>;
                    const list = page.items.filter(person => person.id !== user?.id && person.clubId !== ownClub && person.role !== 'PLAYER').slice(0, 5);
                    return list.length
                        ? <Panel flush><List label={t('People to know')}>{list.map(person => <PersonRow key={person.id} person={person} compact />)}</List></Panel>
                        : <Panel><EmptyNote title={t('No public profiles in {city} yet', { city: area.city })} action={<ButtonLink size="sm" to="/world/people">{t('Browse people')}</ButtonLink>} /></Panel>;
                }}</BlockState>}
        </Section>
    );
}
