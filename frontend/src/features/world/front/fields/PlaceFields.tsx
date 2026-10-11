import { EmptyNote, List, ListRow } from '../../../../design/primitives';
import { ClubCard } from '../../cards/ClubCard';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { useWorldChild } from '../../players';
import { GroupItem } from '../../directories/opportunityItems';
import { useAcademies, useGroups, useNearbyClubs, useNearbyVenues, useOpenClubs } from '../frontData';
import { Cluster, WorldField } from '../WorldField';
import { rowsFor, type FieldProps } from './fieldProps';

/** Clubs around the area, nearest first, as cards with Follow and Open across the page. */
export function ClubsField({ area, markers, side }: FieldProps) {
    const t = useWorldCopy();
    const { child } = useWorldChild();
    const data = useNearbyClubs(area, markers);
    const near = data.items[0], distance = near && data.distance.get(near.id);
    return (
        <WorldField id="clubs" side={side} count={data.data ? data.total : null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={data.items.length ? <Cluster>{data.items.slice(0, 3).map(club => <Crest key={club.id} src={club.logoUrl} name={club.name} size={30} />)}</Cluster> : undefined}
            hint={near ? [`${t('Nearest')}: ${near.name}`, distance != null ? `${distance.toFixed(1)} km` : null].filter(Boolean).join(' · ') : area.city}
            all={{ label: t('All clubs'), to: `/world/clubs?city=${encodeURIComponent(area.city)}${child ? `&player=${child.id}` : ''}` }}>
            {data.items.length ? <div className="gk-wfield__cards">{data.items.slice(0, 4).map(club => <ClubCard key={club.id} club={club} distanceKm={data.distance.get(club.id)} compact />)}</div>
                : <EmptyNote title={t('No clubs listed in {city} yet', { city: area.city })}>{t('Try another area or browse every club.')}</EmptyNote>}
        </WorldField>
    );
}

/** Academies around the area: partners, players and staff. */
export function AcademiesField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useAcademies(area);
    const items = data.data?.content ?? [];
    return (
        <WorldField id="academies" side={side} count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={items.length ? <Cluster>{items.slice(0, 3).map(club => <Crest key={club.id} src={club.logoUrl} name={club.name} size={30} />)}</Cluster> : undefined}
            hint={area.city} all={{ label: t('All academies'), to: `/world/clubs?type=ACADEMY&city=${encodeURIComponent(area.city)}` }}>
            {items.length ? <div className="gk-wfield__cards">{items.slice(0, 4).map(club => <ClubCard key={club.id} club={club} compact />)}</div>
                : <EmptyNote title={t('No academies listed in {city} yet', { city: area.city })} />}
        </WorldField>
    );
}

/** Pitches and halls to hire around the area, nearest first. */
export function VenuesField({ area, markers, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useNearbyVenues(markers);
    const near = data.items[0];
    return (
        <WorldField id="venues" side={side} count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={near ? [`${t('Nearest')}: ${near.title}`, `${near.distanceKm.toFixed(1)} km`].join(' · ') : t('Within 25 km')}
            all={{ label: t('All venues'), to: `/world/venues?city=${encodeURIComponent(area.city)}` }}>
            {data.items.length ? <List label={t('Pitches to hire')}>{data.items.slice(0, rowsFor(side)).map(venue => <ListRow key={venue.entityId} to={`/stadiums/${venue.entityId}`}
                lead={<Crest src={venue.logoUrl} name={venue.title} size={36} />} title={venue.title}
                meta={[venue.subtitle, venue.fee].filter(Boolean).join(' · ')} trail={<span className="gk-faint">{venue.distanceKm.toFixed(1)} km</span>} />)}</List>
                : <EmptyNote title={t('No venues listed within 25 km')} />}
        </WorldField>
    );
}

/** Clubs in the area with open trials or open to applications: where a player can join. */
export function OpenClubsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useOpenClubs(area);
    const items = data.data?.content ?? [];
    return (
        <WorldField id="openClubs" side={side} count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={items.length ? <Cluster>{items.slice(0, 3).map(club => <Crest key={club.id} src={club.logoUrl} name={club.name} size={30} />)}</Cluster> : undefined}
            hint={area.city} all={{ label: t('All clubs taking players'), to: `/world/clubs?joinPolicy=OPEN_TRIAL&joinPolicy=APPLICATION_REQUIRED&city=${encodeURIComponent(area.city)}` }}>
            {items.length ? <div className="gk-wfield__cards">{items.slice(0, 4).map(club => <ClubCard key={club.id} club={club} compact />)}</div>
                : <EmptyNote title={t('No clubs in {city} are taking players right now', { city: area.city })} />}
        </WorldField>
    );
}

/** Training groups with places: for the chosen child's age when there is one. */
export function GroupsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const { child } = useWorldChild();
    const data = useGroups(area);
    const items = data.data?.items ?? [];
    return (
        <WorldField id="groups" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={child ? t('For {name}', { name: child.name }) : area.city}
            all={{ label: t('All places to train'), to: `/world/opportunities?tab=groups${child ? `&player=${child.id}` : ''}` }}>
            {items.length ? <List label={t('Places to train')}>{items.slice(0, rowsFor(side)).map(group => <GroupItem key={group.id} item={{ group, player: child?.id }} />)}</List>
                : <EmptyNote title={t('No groups with places in {city} right now', { city: area.city })} />}
        </WorldField>
    );
}
