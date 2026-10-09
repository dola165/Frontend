import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import type { PublicFacility } from '../../features/clubs/ClubPlaceCard';
import { FacilityDirectionsPanel } from '../../features/clubs/FacilityDirectionsPanel';
import { placeType } from '../../features/clubs/clubPlaceTypes';

type TrainingVenueProps={clubId:number;squadIds:number[]};
export function TrainingVenues(props:TrainingVenueProps) {
  return <TrainingVenueList key={props.clubId+":"+props.squadIds.join(",")} {...props}/>;
}
function TrainingVenueList({clubId,squadIds}:TrainingVenueProps) {
  const [places,setPlaces]=useState<PublicFacility[]|null>(null),[failed,setFailed]=useState(false),[selected,setSelected]=useState<PublicFacility|null>(null);
  const scope=squadIds.join(',');
  useEffect(()=>{const abort=new AbortController();void apiClient.get<PublicFacility[]>(`/clubs/${clubId}/facilities`,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setPlaces(r.data.filter(p=>placeType(p)!=='FACILITY'&&(p.squadId==null||scope.split(',').includes(String(p.squadId)))));}).catch(()=>{if(!abort.signal.aborted)setFailed(true);});return()=>abort.abort();},[clubId,scope]);
  return <section className="cp-card cp-training-venues"><h3><MapPin size={18}/> Where you’ll train</h3>{failed?<p>Venue details could not load. <Link to={`/clubs/${clubId}?tab=facilities`}>View club locations</Link></p>:places===null?<p role="status">Loading training venues…</p>:places.length?places.map(place=><article key={place.id}><div><strong>{place.title}</strong><p>{place.details.address||place.linkedVenue?.address||'Address to be confirmed with the club'}</p><small>{placeType(place)==='UNCLASSIFIED'?'Club location · confirm training use':place.squadName||'Club venue · confirm this group’s session location'}</small></div><button type="button" className="cp-button" onClick={()=>setSelected(place)}><Navigation size={16}/>Map & directions</button></article>):<p>The club has not published a training venue for this group yet. Your contact will confirm the location before your visit.</p>}{selected&&<FacilityDirectionsPanel clubId={clubId} facilityId={selected.id} title={selected.title} address={selected.details.address||selected.linkedVenue?.address} onClose={()=>setSelected(null)}/>}</section>;
}
