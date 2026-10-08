import type { DiscoveryQuery } from '../types';
import type { MapFilters } from '../../../components/map/MapFilterSidebar';
import { coverageBounds, type MapBounds, type SearchCoverage } from '../../../components/map/areaSearch';
/** Spatial predicates refer to the opportunity's venue. Multiple sporting choices remain same-group client predicates. */
export function admissionMapQuery(filters:MapFilters,center:[number,number],area:MapBounds|null,coverage:SearchCoverage,q:string,page=0):DiscoveryQuery {
    const f=filters.clubs,bounds=coverageBounds(coverage,area);
    const genders=new Set(f.genders.map(g=>g==='Boys'||g==='Men'?'MALE':g==='Girls'||g==='Women'?'FEMALE':'ANY'));
    const gender=genders.size===1&&!genders.has('ANY')?[...genders][0] as 'MALE'|'FEMALE':undefined;
    return {q:q||undefined,birthYear:f.birthYear,gender,acceptingOnly:f.openTryoutsOnly,includeWaitlist:f.includeWaitlist,
        ...(bounds?{minLat:bounds.south,maxLat:bounds.north,minLng:bounds.west,maxLng:bounds.east}:{latitude:center[0],longitude:center[1],radiusKm:Math.min(500,filters.distanceKm)}),
        country:f.country?[f.country]:undefined,city:f.city?[f.city]:undefined,category:f.categories.length?f.categories:undefined,
        verifiedOnly:f.officialOnly,level:f.levels.length===1?f.levels[0]:undefined,position:filters.positions.length===1?filters.positions[0]:undefined,size:100,page};
}
