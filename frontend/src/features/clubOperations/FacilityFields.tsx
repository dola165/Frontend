import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ImageUploadField } from '../../components/workspace/editor/ImageUploadField';
import { LocationPicker } from '../../components/workspace/editor/LocationPicker';
import type { Bootstrap, Definition, Field } from './api';

export function FacilityFields({ mode, boot, definition, data, change, renderField, onUploading }: {
  mode:'place'|'visitors'; boot:Bootstrap; definition:Definition; data:Record<string,string>;
  change:(values:Record<string,string>)=>void; renderField:(f:Field)=>ReactNode; onUploading:(value:boolean)=>void;
}) {
  const [query,setQuery]=useState(''), [mapOpen,setMapOpen]=useState(false);
  const fields=(keys:string[])=>definition.fields.filter(f=>keys.includes(f.key)).map(renderField);
  const venue=boot.venues.find(v=>String(v.id)===data.venueId);
  const venues=boot.venues.filter(v=>v.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  if(mode==='visitors') return <>
    <section className="editor-field-group"><header><h5>Photos</h5><p>Show the venue or supporting facility and its entrance.</p></header><ImageUploadField label="Location photos" images={(data.photos??'').split(/\r?\n/).filter(Boolean)} onChange={images=>change({photos:images.join('\n')})} onBusyChange={onUploading}/></section>
    <section className="editor-field-group"><header><h5>Getting there</h5><p>Optional public information to help anyone visiting this place.</p></header><div className="ops-form-grid">{fields(['arrival','transport','accessibility'])}</div></section>
    <section className="editor-field-group"><header><h5>At this location</h5><p>Facilities, preparation and contact details.</p></header><div className="ops-form-grid">{fields(['amenities','whatToBring','contact'])}</div></section>
    <section className="editor-field-group"><header><h5>Parents & collection</h5><p>Add this only when it applies to the groups using this location.</p></header>{fields(['collection'])}</section>
  </>;
  return <>
    <div className="ops-form-grid">{fields(['placeType','address','relationship','description'])}</div>
    <details className="workspace-editor__details" open={data.venueId ? true : undefined}><summary>Link a published venue (optional)</summary><div className="workspace-editor__details-body"><p className="editor-field-help">For a playing ground, link its existing venue page. For a supporting facility, link the venue it belongs to. Linking does not claim ownership, reserve a pitch or make this place available to rent. Your address and entrance instructions remain specific to this location.</p>
      {data.venueId ? <div className="editor-selected-venue"><div><strong>{venue?.name??'Previously linked venue'}</strong><p><Link to={`/stadiums/${data.venueId}`} target="_blank" rel="noreferrer">View venue page</Link></p></div><button type="button" onClick={()=>change({venueId:''})}>Unlink</button></div> : <><label>Find an existing venue<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search venue name"/></label><div className="editor-venue-results">{venues.slice(0,20).map(v=><button type="button" key={v.id} onClick={()=>change({venueId:String(v.id)})}>{v.name}</button>)}</div><p className="editor-field-help">{!venues.length?'No matching venue. You can still save this venue or facility without a link.':venues.length>20?'Keep typing to narrow the list.':'Choose a venue or leave this section empty.'}</p></>}
    </div></details>
    <details className="workspace-editor__details" onToggle={e=>setMapOpen(e.currentTarget.open)}><summary>Set the visitor entrance on the map (optional)</summary>{mapOpen && <LocationPicker latitude={data.latitude??''} longitude={data.longitude??''} onChange={(latitude,longitude)=>change({latitude,longitude})}/>}</details>
  </>;
}
