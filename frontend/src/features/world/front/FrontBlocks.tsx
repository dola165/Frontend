import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Briefcase, Handshake, MapPin, Shield, Trophy, Users } from 'lucide-react';
import { Avatar, Badge, ButtonLink, EmptyNote, List, ListRow } from '../../../design/primitives';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import type { MapPageResult } from '../../../api/map';
import { activityColors } from '../../schedule/activityIcons';
import { formats } from '../../matchExchange/api';
import { ClubCard } from '../cards/ClubCard';
import { plural, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { ErrorNote } from '../directory/DirectoryResults';
import { ListingItem } from '../directories/matchItems';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import { codeLabel, fixtureDay, fixtureTime } from '../format';
import { useWorldChild } from '../players';
import { CompetitionRow, EventItemRow, JobRow, PersonRow } from '../rows';
import type { WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import { useComingUp, useFrontOpportunities, useNearbyClubs, useNearbyVenues, useOpenCompetitions, useOpenMatches, usePeopleNearby } from './frontData';
import { WorldTile } from './WorldTile';

/** The map of clubs and venues around the area: the biggest thing on the page, with the way into the full map. */
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
        <section id="world-around" className="gk-world-front__map" aria-label={t('Around {city}', { city: area.city })}>
            {markers.error
                ? <ErrorNote message={markers.error} onRetry={markers.retry} />
                : <WorldMap label={t('Clubs and venues around {city}', { city: area.city })} points={points}
                    footer={<>{markers.data ? <span>{t('{clubs} and {venues} within 25 km', { clubs: plural(clubs, 'club'), venues: plural(points.length - clubs, 'venue') })}</span> : <span>{t('Finding clubs and venues…')}</span>}
                        <ButtonLink size="sm" variant="ghost" to={`/world/map?region=${encodeURIComponent(area.city)}`}>{t('Open full map')}</ButtonLink></>} />}
        </section>
    );
}

/** What every tile is given by the page: whether it is the open one, and how to open or close it. */
export interface TileProps { area: WorldArea; open: boolean; onToggle: () => void }
const when = (value?: string | null, zone?: string) => value ? `${fixtureDay(value, zone)} ${fixtureTime(value, zone)}` : '';
/** A few crests or faces overlapping, as a thumbnail or a preview. */
const Cluster = ({ children }: { children: ReactNode }) => <span className="gk-wtile__cluster">{children}</span>;
const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];

/** Teams near the area looking for an opponent: a coach's first reason to open World. */
export function OpenMatchesTile({ area, open, onToggle }: TileProps) {
    const t = useWorldCopy();
    const data = useOpenMatches(area);
    const items = [...(data.data?.items ?? [])].sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    const next = items[0];
    const clubs = unique(items, m => String(m.club_id)).slice(0, 3);
    return (
        <WorldTile id="matches" title={t('Teams looking for a match')} icon={Handshake} color={activityColors.FRIENDLY} photo="/football/touchline.jpg"
            count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry} open={open} onToggle={onToggle}
            summary={next ? `${when(next.starts_at_iso, next.timezone)} · ${next.club_name} ${next.squad_name} · ${t(formats[next.format] ?? codeLabel(next.format))}` : t('No team is looking for an opponent right now')}
            preview={clubs.length > 0 && <Cluster>{clubs.map(m => <Crest key={m.club_id} src={m.club_logo_url} name={m.club_name} size={26} />)}</Cluster>}
            all={{ label: t('All open matches'), to: '/world/matches?tab=exchange' }}>
            {items.length ? <List label={t('Teams looking for a match')}>{items.slice(0, 5).map(m => <ListingItem key={m.event_id} item={m} />)}</List>
                : <EmptyNote title={t('No open matches right now')} action={<ButtonLink size="sm" to="/world/matches/arrange">{t('Arrange a match')}</ButtonLink>}>{t('Teams post here when they need an opponent for a date.')}</EmptyNote>}
        </WorldTile>
    );
}

/** Published matches, competitions and trials near you in the next ten days. */
export function ComingUpTile({ area, open, onToggle }: TileProps) {
    const t = useWorldCopy();
    const data = useComingUp(area);
    const next = data.items[0];
    return (
        <WorldTile id="events" title={t('Matches near you')} icon={Trophy} color={activityColors.MATCH} photo="/football/ball-field.jpg"
            count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry} open={open} onToggle={onToggle}
            summary={next ? `${when(next.startsAt)} · ${next.name}` : t('Nothing published in the next 10 days')}
            all={{ label: t('All events'), to: data.all }}>
            {data.items.length ? <List label={t('Matches near you')}>{data.items.slice(0, 6).map(item => <EventItemRow key={`${item.kind}:${item.id}`} item={item} />)}</List>
                : <EmptyNote title={t('Nothing published near {city} in the next 10 days', { city: area.city })}>{t('Clubs and organisers publish matches, trials and competitions here.')}</EmptyNote>}
        </WorldTile>
    );
}

/** Leagues and cups taking entries now: where a coach enters a squad. */
export function CompetitionsTile({ open, onToggle }: TileProps) {
    const t = useWorldCopy();
    const data = useOpenCompetitions();
    const items = data.data?.content ?? [];
    const next = items[0];
    const rules = next?.profile?.rules;
    return (
        <WorldTile id="competitions" title={t('Open for entries')} icon={Trophy} color={activityColors.MATCH} photo="/venue-demo/pitch-aerial.jpg"
            count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry} open={open} onToggle={onToggle}
            summary={next ? [next.name, rules && codeLabel(rules.ageGroup), rules && `${rules.sideSize}v${rules.sideSize}`].filter(Boolean).join(' · ') : t('No competitions are taking entries')}
            all={{ label: t('All competitions'), to: '/world/competitions?registration=OPEN' }}>
            {items.length ? <List label={t('Open for entries')}>{items.slice(0, 5).map(card => <CompetitionRow key={card.id} card={card} compact />)}</List>
                : <EmptyNote title={t('No competitions are taking entries')}>{t('New leagues and cups appear here when entries open.')}</EmptyNote>}
        </WorldTile>
    );
}

const ROLE_WORDS: Record<string, [string, string]> = { REFEREE: ['referee', 'referees'], COACH: ['coach', 'coaches'], AGENT: ['agent', 'agents'], SPECIALIST: ['specialist', 'specialists'], CLUB_STAFF: ['club staff', 'club staff'] };

/** Referees, coaches and specialists from outside the person's own club, as faces. */
export function PeopleTile({ area, open, onToggle }: TileProps) {
    const t = useWorldCopy();
    const location = useLocation();
    const data = usePeopleNearby(area);
    const roles = Object.entries(data.items.reduce<Record<string, number>>((all, person) => ({ ...all, [person.role]: (all[person.role] ?? 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1]).map(([role, count]) => plural(count, ...(ROLE_WORDS[role] ?? [role.toLowerCase(), `${role.toLowerCase()}s`]) as [string, string]));
    const faces = data.items.slice(0, 3);
    return (
        <WorldTile id="people" title={t('People to know')} icon={Users} open={open} onToggle={onToggle}
            thumb={faces.length ? <Cluster>{faces.map(person => <Avatar key={person.id} src={person.avatarUrl} name={person.fullName} size={30} />)}</Cluster> : undefined}
            count={data.data && !data.searchOnly ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            summary={!data.signedIn ? t('Sign in to find people by role and area') : data.searchOnly ? t('Search coaches, referees and specialists by name') : roles.length ? roles.slice(0, 3).join(' · ') : t('No public profiles in {city} yet', { city: area.city })}
            all={data.signedIn ? { label: t('All people'), to: '/world/people' } : undefined}>
            {!data.signedIn ? <EmptyNote title={t('Coaches, referees and specialists')} action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>} />
                : data.items.length ? <List label={t('People to know')}>{data.items.slice(0, 5).map(person => <PersonRow key={person.id} person={person} compact />)}</List>
                    : <EmptyNote title={t('Find people by name')} action={<ButtonLink size="sm" to="/world/people">{t('Search people')}</ButtonLink>} />}
        </WorldTile>
    );
}

/** Pitches to hire near the area, nearest first. */
export function VenuesTile({ area, open, onToggle, markers }: TileProps & { markers: WorldData<MapPageResult> }) {
    const t = useWorldCopy();
    const data = useNearbyVenues(markers);
    const near = data.items[0];
    return (
        <WorldTile id="venues" title={t('Pitches to hire')} icon={MapPin} photo="/venue-demo/pitch-day.jpg"
            count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry} open={open} onToggle={onToggle}
            summary={near ? [near.title, `${near.distanceKm.toFixed(1)} km`, near.fee].filter(Boolean).join(' · ') : t('No venues listed within 25 km')}
            all={{ label: t('All venues'), to: `/world/venues?city=${encodeURIComponent(area.city)}` }}>
            {data.items.length ? <List label={t('Pitches to hire')}>{data.items.slice(0, 5).map(venue => <ListRow key={venue.entityId} to={`/stadiums/${venue.entityId}`}
                lead={<Crest src={venue.logoUrl} name={venue.title} size={36} />} title={venue.title}
                meta={[venue.subtitle, venue.fee].filter(Boolean).join(' · ')} trail={<span className="gk-faint">{venue.distanceKm.toFixed(1)} km</span>} />)}</List>
                : <EmptyNote title={t('No venues listed within 25 km')} />}
        </WorldTile>
    );
}

/** Open jobs, volunteering and trials. */
export function OpportunitiesTile({ area, open, onToggle }: TileProps) {
    const t = useWorldCopy();
    const data = useFrontOpportunities(area);
    const jobs = data.data?.jobs ?? [], trials = data.data?.trials ?? [];
    return (
        <WorldTile id="jobs" title={t('Jobs, volunteering and trials')} icon={Briefcase} photo="/venue-demo/pitch-sun.jpg"
            count={data.data ? jobs.length + (data.data.trialTotal ?? trials.length) : null} loading={data.loading} error={data.error} onRetry={data.retry} open={open} onToggle={onToggle}
            summary={data.data ? [jobs.length ? plural(jobs.length, 'job') : null, trials.length ? plural(data.data.trialTotal ?? trials.length, 'open trial') : null].filter(Boolean).join(' · ') || t('No open roles or trials right now') : undefined}
            preview={jobs.length > 0 && <Cluster>{unique(jobs, job => job.clubName ?? job.title).slice(0, 3).map(job => <Crest key={job.id} src={job.clubLogoUrl} name={job.clubName ?? job.title} size={26} />)}</Cluster>}
            all={{ label: t('All opportunities'), to: '/world/opportunities' }}>
            {jobs.length || trials.length ? <List label={t('Opportunities')}>
                {trials.slice(0, 2).map(trial => <ListRow key={`t${trial.id}`} to={`/tryouts/${trial.id}`} lead={<Crest name={trial.clubName} size={36} />} title={trial.title}
                    meta={[trial.clubName, when(trial.tryoutDate), codeLabel(trial.ageGroup)].filter(Boolean).join(' · ')} trail={<Badge tone="warning">{t('Trial')}</Badge>} />)}
                {jobs.slice(0, 4).map(job => <JobRow key={`j${job.id}`} job={job} compact />)}
            </List> : <EmptyNote title={t('No open roles or trials right now')}>{t('Clubs post jobs, volunteering and trials here.')}</EmptyNote>}
        </WorldTile>
    );
}

/** Clubs around the area, nearest first, as crests. */
export function ClubsTile({ area, open, onToggle, markers }: TileProps & { markers: WorldData<MapPageResult> }) {
    const t = useWorldCopy();
    const { child } = useWorldChild();
    const data = useNearbyClubs(area, markers);
    const near = data.items[0], distance = near && data.distance.get(near.id);
    return (
        <WorldTile id="clubs" title={child ? t('Clubs for {name}', { name: child.name }) : t('Clubs near you')} icon={Shield} open={open} onToggle={onToggle}
            thumb={data.items.length ? <Cluster>{data.items.slice(0, 3).map(club => <Crest key={club.id} src={club.logoUrl} name={club.name} size={30} />)}</Cluster> : undefined}
            count={data.data ? data.total : null} loading={data.loading} error={data.error} onRetry={data.retry}
            summary={near ? [near.name, distance != null ? `${distance.toFixed(1)} km` : null].filter(Boolean).join(' · ') : t('No clubs listed in {city} yet', { city: area.city })}
            all={{ label: t('All clubs'), to: `/world/clubs?city=${encodeURIComponent(area.city)}${child ? `&player=${child.id}` : ''}` }}>
            {data.items.length ? <div className="gk-wtile__clubs">{data.items.slice(0, 4).map(club => <ClubCard key={club.id} club={club} distanceKm={data.distance.get(club.id)} compact />)}</div>
                : <EmptyNote title={t('No clubs listed in {city} yet', { city: area.city })}>{t('Try another area or browse every club.')}</EmptyNote>}
        </WorldTile>
    );
}
