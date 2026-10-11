import type { ComponentType } from 'react';
import { ButtonLink } from '../../../design/primitives';
import type { MapPageResult } from '../../../api/map';
import { plural, useWorldCopy } from '../copy';
import { ErrorNote } from '../directory/DirectoryResults';
import { WorldMap, type WorldMapPoint } from '../map/WorldMap';
import type { WorldData } from '../useWorldData';
import type { WorldArea } from '../useWorldArea';
import type { FieldId } from './fields';
import type { FieldProps } from './fields/fieldProps';
import { ArrangementsField, CompetitionsField, EventsField, LiveCompetitionsField, OpenMatchesField, RefereeNeededField, ResultsField } from './fields/MatchFields';
import { CampaignsField, CoachingJobsField, JobsField, StaffJobsField, TrialsField, VolunteeringField } from './fields/OpportunityFields';
import { PeopleField, RefereesField, SpecialistsField } from './fields/PeopleFields';
import { AcademiesField, ClubsField, GroupsField, OpenClubsField, VenuesField } from './fields/PlaceFields';

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

const FIELD_VIEWS: Record<FieldId, ComponentType<FieldProps>> = {
    matches: OpenMatchesField, events: EventsField, refereeNeeded: RefereeNeededField, competitions: CompetitionsField, liveCompetitions: LiveCompetitionsField,
    results: ResultsField, arrangements: ArrangementsField,
    people: PeopleField, referees: RefereesField, specialists: SpecialistsField,
    clubs: ClubsField, academies: AcademiesField, openClubs: OpenClubsField, groups: GroupsField, venues: VenuesField,
    trials: TrialsField, jobs: JobsField, coachingJobs: CoachingJobsField, staffJobs: StaffJobsField, volunteering: VolunteeringField, campaigns: CampaignsField,
};

/** One field of the front page, by id. */
export function Field({ id, ...props }: FieldProps & { id: FieldId }) {
    const View = FIELD_VIEWS[id];
    return <View {...props} />;
}
