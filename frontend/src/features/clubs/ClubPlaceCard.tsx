import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, MapPin, Navigation, Warehouse, X } from 'lucide-react';
import { MediaImage } from '../../components/ui/MediaImage';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { FacilityDirectionsPanel } from './FacilityDirectionsPanel';
import './club-places.css';
import { placeType } from './clubPlaceTypes';
import { useClubPanelMotion } from './useClubPanelMotion';

export interface PublicFacility {
  id:number; title:string; details:Record<string,string>; squadId?:number|null; squadName?:string|null;
  linkedVenue?:{id:number;name:string;address?:string;city?:string;photo?:string;amenities?:string[];bookingAvailable:boolean}|null;
}
const typeLabel = (place:PublicFacility) => placeType(place)==='VENUE' ? 'Playing venue' : placeType(place)==='FACILITY' ? 'Supporting facility' : 'Club location';
function photosFor(place:PublicFacility) {
  const photos=(place.details.photos??'').split(/\r?\n/).map(v=>v.trim()).filter(v=>{
    if(/^\/uploads\/[A-Za-z0-9_-]+\.jpg$/.test(v))return true;
    try {const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
  });
  return [...new Set(photos.length ? photos : placeType(place)==='VENUE'&&place.linkedVenue?.photo ? [place.linkedVenue.photo] : [])];
}
const relationship = (value:string) => ({OWNED:'Club-owned',RENTED:'Rented by the club',SHARED:'Shared use',REGULAR_USE:'Regular use'} as Record<string,string>)[value];

export function FacilityCard({facility,clubId}:{facility:PublicFacility;clubId?:number}) {
  const [open,setOpen]=useState(false),[directions,setDirections]=useState(false),[failed,setFailed]=useState<string|null>(null);
  const photos=photosFor(facility), photo=photos[0]!==failed?photos[0]:null;
  const address=facility.details.address || (placeType(facility)==='VENUE'?facility.linkedVenue?.address:undefined);
  return <article className="club-place-card" id={`facility-${facility.id}`}>
    <div className="club-place-photo">{photo?<MediaImage src={resolveMediaUrl(photo)} alt={facility.title} loading="lazy" onError={()=>setFailed(photo)}/>:placeType(facility)==='FACILITY'?<Building2 size={36}/>:<Warehouse size={36}/>}</div>
    <div className="club-place-content"><div className="club-place-tags"><span>{typeLabel(facility)}</span>{relationship(facility.details.relationship)&&<span>{relationship(facility.details.relationship)}</span>}</div>
      <h3>{facility.title || 'Location name'}</h3><p className="club-place-address"><MapPin size={16}/>{address || 'Address not published'}</p>
      <p className="cp-muted">{facility.squadName || (facility.squadId ? 'Assigned squad' : 'Club-wide')}</p>
      {facility.details.description&&<p className="club-place-summary">{facility.details.description}</p>}
      <div className="club-place-actions"><button type="button" className="cp-button" onClick={()=>setOpen(true)}>View {placeType(facility)==='VENUE'?'venue':placeType(facility)==='FACILITY'?'facility':'location'}<ArrowRight size={16}/></button>{clubId&&facility.id>0&&<button type="button" className="cp-button" onClick={()=>setDirections(true)}><Navigation size={16}/>Get directions</button>}</div>
    </div>
    {open&&<PlaceDetails place={facility} clubId={clubId} onClose={()=>setOpen(false)}/>}
    {directions&&clubId&&<FacilityDirectionsPanel clubId={clubId} facilityId={facility.id} title={facility.title} address={address} onClose={()=>setDirections(false)}/>}
  </article>;
}

function PlaceDetails({place,clubId,onClose}:{place:PublicFacility;clubId?:number;onClose:()=>void}) {
  const motion=useClubPanelMotion(onClose);
  const ref=useRef<HTMLElement>(null),heading=useId();useDialogFocus(true,ref,motion.close);
  const [directions,setDirections]=useState(false),d=place.details,venue=place.linkedVenue,photos=photosFor(place);
  const sections=[['About this place',d.description],['Arrival & meeting point',d.arrival],['Parking & transport',d.transport],['Amenities',d.amenities],['Accessibility',d.accessibility],['What to bring',d.whatToBring],['Parents & collection',d.collection],['Club contact at this location',d.contact]].filter(([,text])=>text);
  return createPortal(<div className="club-place-backdrop club-motion-backdrop" data-closing={motion.closing} onClick={motion.close}><section ref={ref} className="club-public club-place-dialog club-motion-panel" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={e=>e.stopPropagation()}>
    <header><div><p className="cp-eyebrow">{typeLabel(place)}</p><h2 id={heading}>{place.title}</h2><p>{d.address || (placeType(place)==='VENUE'?venue?.address:'')}</p></div><button className="cp-icon-button" type="button" aria-label="Close location details" onClick={motion.close}><X size={22}/></button></header>
    <div className="club-place-detail-body">
      {!!photos.length&&<div className="club-place-gallery">{photos.map((p,i)=><MediaImage key={p} src={resolveMediaUrl(p)} alt={`${place.title} — photo ${i+1}`} loading="lazy"/>)}</div>}
      <p className="cp-muted">{[relationship(d.relationship),place.squadName || (place.squadId?'Assigned squad':'Club-wide')].filter(Boolean).join(' · ')}</p>
      {clubId&&place.id>0&&<button className="cp-button" type="button" onClick={()=>setDirections(true)}><Navigation size={16}/>Get directions</button>}
      <div className="club-place-detail-grid">{sections.map(([title,text])=><section key={title}><h3>{title}</h3><p>{text}</p></section>)}</div>
      {!d.arrival&&<p className="club-place-notice"><strong>Visiting for the first time?</strong> Confirm the entrance and meeting point with the club.</p>}
      {venue&&<section className="club-place-linked"><h3>{placeType(place)==='VENUE'?'Venue information':'At this venue'}</h3><p>{venue.name}{venue.city?` · ${venue.city}`:''}</p>
        {!!venue.amenities?.length&&<p>{venue.amenities.map(a=>a.replaceAll('_',' ').toLowerCase()).join(' · ')}</p>}
        <div className="club-place-actions"><Link className="cp-button" to={`/stadiums/${venue.id}`}>View venue page<ArrowRight size={16}/></Link>{venue.bookingAvailable&&<Link className="cp-button" to={`/stadiums/${venue.id}?book=1`}>Rental availability<ArrowRight size={16}/></Link>}</div>
        <p className="cp-muted">{venue.bookingAvailable?'Rentals are handled by the venue operator. A club session is arranged separately.':'This venue is not accepting online rental bookings.'}</p>
      </section>}
      {!venue&&placeType(place)==='VENUE'&&<p className="cp-muted">Listed as a place the club plays or trains. No rental booking is offered through this listing.</p>}
      {clubId&&<Link className="cp-button" to={`/clubs/${clubId}?tab=contact`} onClick={onClose}>Contact the club<ArrowRight size={16}/></Link>}
    </div>
    {directions&&clubId&&<FacilityDirectionsPanel clubId={clubId} facilityId={place.id} title={place.title} address={d.address} onClose={()=>setDirections(false)}/>}
  </section></div>,document.body);
}
