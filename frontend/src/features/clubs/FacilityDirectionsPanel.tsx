import { visualColors } from '../../styles/visualColors';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source, type MapRef } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import { ArrowLeft, Footprints, LocateFixed, MapPin, X } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { getHeritageStyle } from '../../components/map/heritageStyle';
import { MAP_STYLE_DEFAULT } from '../../components/map/mapLayers';
import { loadWalkingRoute } from '../../components/map/walkingRoutes';
import type { Coordinate, WalkingRoute } from '../../components/map/walkingGraph';
import 'maplibre-gl/dist/maplibre-gl.css';
import './family-journeys.css';
import { createPortal } from 'react-dom';
import { useClubPanelMotion } from './useClubPanelMotion';

interface Point { latitude: number; longitude: number; label?: string }
interface Location { source: string; address: string; matches: Point[]; area?: Point; notice?: string }
export function FacilityDirectionsPanel({ clubId, facilityId, title, address, onClose }: { clubId: number; facilityId: number; title: string; address?: string; onClose: () => void }) {
  const motion=useClubPanelMotion(onClose);
  const heading=useId(),panel=useRef<HTMLDivElement>(null),map=useRef<MapRef>(null);
  useDialogFocus(true,panel,motion.close);
  const [location,setLocation]=useState<Location|null>(null),[destination,setDestination]=useState<Coordinate|null>(null),[origin,setOrigin]=useState<Coordinate|null>(null);
  const [error,setError]=useState(''),[mapError,setMapError]=useState(false),[loading,setLoading]=useState(true),[locating,setLocating]=useState(false),[retry,setRetry]=useState(0);
  const [routeResult,setRouteResult]=useState<{key:string;route:WalkingRoute|null;error:string}|null>(null),[routeAttempt,setRouteAttempt]=useState(0),[pick,setPick]=useState<'start'|'destination'|null>(null),[manual,setManual]=useState(false),[style,setStyle]=useState<StyleSpecification>();
  const [startLat,setStartLat]=useState(''),[startLng,setStartLng]=useState(''),[mapReady,setMapReady]=useState(false);
  const alive=useRef(true),locationAttempt=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{const c=new AbortController();void apiClient.get<Location>(`/clubs/${clubId}/facilities/${facilityId}/map-location`,{signal:c.signal}).then(r=>{if(c.signal.aborted)return;setLocation(r.data);setDestination(r.data.matches.length===1?[r.data.matches[0].longitude,r.data.matches[0].latitude]:null);}).catch(()=>{if(!c.signal.aborted)setError('The location could not load. Please retry.');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[clubId,facilityId,retry]);
  useEffect(()=>{let active=true;void getHeritageStyle('light', {includeTerrain:false}).then(s=>{if(active)setStyle(s);}).catch(()=>{});return()=>{active=false;};},[]);
  const routeKey=origin&&destination?JSON.stringify([origin,destination,routeAttempt]):'';
  const route=routeResult?.key===routeKey?routeResult.route:null,routing=Boolean(routeKey&&routeResult?.key!==routeKey),routeError=routeResult?.key===routeKey?routeResult.error:'';
  useEffect(()=>{const c=new AbortController();if(origin&&destination)void loadWalkingRoute(origin,destination,c.signal).then(route=>{if(!c.signal.aborted)setRouteResult({key:routeKey,route,error:''});}).catch(e=>{if(!c.signal.aborted)setRouteResult({key:routeKey,route:null,error:e instanceof Error?e.message:'A walking route could not be found.'});});return()=>c.abort();},[origin,destination,routeKey]);
  const fit=useCallback(()=>{const points=route?.coordinates??(destination?[...(origin?[origin]:[]),destination]:location?.area?[[location.area.longitude,location.area.latitude] as Coordinate]:[]);if(!points.length)return;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);map.current?.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:55,maxZoom:16,duration:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:350});},[route,destination,origin,location]);
  useEffect(()=>{fit();},[fit]); // camera follows only this journey
  const locate=()=>{if(!navigator.geolocation){setError('Location is unavailable. Pick your starting point on the map.');return;}const attempt=++locationAttempt.current;setLocating(true);setError('');navigator.geolocation.getCurrentPosition(p=>{if(!alive.current||attempt!==locationAttempt.current)return;setLocating(false);setPick(null);setOrigin([p.coords.longitude,p.coords.latitude]);},()=>{if(!alive.current||attempt!==locationAttempt.current)return;setLocating(false);setError('Location was not available. You can still pick your starting point on the map.');},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});};
  const chooseStart=()=>{locationAttempt.current++;setLocating(false);setPick('start');setError('');};
  const point=(p:Point)=>{setManual(false);setDestination([p.longitude,p.latitude]);setPick(null);};
  const line=route?{type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:route.coordinates}}:null;
  const connectors=route&&origin&&destination?{type:'Feature' as const,properties:{},geometry:{type:'MultiLineString' as const,coordinates:[[origin,route.coordinates[0]],[route.coordinates.at(-1)!,destination]]}}:null;
  return createPortal(<div className="fj-drawer-backdrop club-motion-backdrop" data-closing={motion.closing} onClick={motion.close}><section ref={panel} className="club-public fj-directions club-motion-panel" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} role="dialog" aria-modal="true" aria-labelledby={heading} onClick={e=>e.stopPropagation()}>
    <header><div><button className="cp-text-button fj-directions-back" onClick={motion.close}><ArrowLeft size={16}/>Back to location</button><p className="cp-eyebrow"><Footprints size={14}/>Walking directions</p><h2 id={heading}>{title}</h2><p>{address}</p></div><button className="cp-icon-button" aria-label="Close directions" onClick={motion.close}><X size={20}/></button></header>
    <div className="fj-directions-body">
      {loading?<p role="status">Finding the location…</p>:<>
        {location?.notice&&<p className="cp-muted">{location.notice}</p>}
        {location?.source==='ADDRESS_MATCH'&&destination&&!manual&&<p className="fj-location-note">Address match · check the entrance with the club. <button className="cp-text-button" onClick={()=>setPick('destination')}>Adjust arrival point</button></p>}
        {manual&&<p className="fj-location-note">Arrival point chosen by you for this walk.</p>}
        {!destination&&<div className="fj-location-options"><strong>{location?.matches.length?'Choose the correct address':'The club has not pinned this entrance yet'}</strong>{location?.matches.map((p,i)=><button className="cp-button" key={i} onClick={()=>point(p)}><MapPin size={15}/>{p.label}</button>)}<button className="cp-button" onClick={()=>setPick('destination')}>Choose arrival point on map</button></div>}
        <div className="fj-map" aria-label="Walking route map">
          <Map ref={map} initialViewState={{longitude:destination?.[0]??location?.area?.longitude??0,latitude:destination?.[1]??location?.area?.latitude??20,zoom:destination?15:location?.area?12:2}} mapStyle={style??MAP_STYLE_DEFAULT} dragRotate={false} touchPitch={false} maxPitch={0} onLoad={fit} onIdle={()=>{if(map.current?.areTilesLoaded()){setMapReady(true);setMapError(false);}}} onError={()=>setMapError(true)} onClick={e=>{if(pick==='start'){locationAttempt.current++;setLocating(false);setOrigin([e.lngLat.lng,e.lngLat.lat]);}if(pick==='destination'){setDestination([e.lngLat.lng,e.lngLat.lat]);setManual(true);}setPick(null);}} cursor={pick?'crosshair':undefined} style={{width:'100%',height:'100%'}}>
            <NavigationControl position="bottom-right" showCompass={false}/>
            {destination&&<Marker longitude={destination[0]} latitude={destination[1]} anchor="bottom"><span className="fj-map-pin" aria-label="Training location"><MapPin size={27}/></span></Marker>}
            {origin&&<Marker longitude={origin[0]} latitude={origin[1]}><span className="fj-map-start" aria-label="Your starting point"/></Marker>}
            {line&&<Source id="walk-path" type="geojson" data={line}><Layer id="walk-path-line" type="line" paint={{'line-color':visualColors.facilityDirectionsPanelPaint159,'line-width':5}}/></Source>}
            {connectors&&<Source id="walk-connectors" type="geojson" data={connectors}><Layer id="walk-connectors-line" type="line" paint={{'line-color':visualColors.facilityDirectionsPanelPaint160,'line-width':3,'line-dasharray':[2,2]}}/></Source>}
          </Map>
          {!mapReady&&!mapError&&<p className="fj-map-loading" role="status">Loading streets and footpaths…</p>}
          {pick&&<p className="fj-map-prompt" role="status">Tap the map to choose your {pick==='start'?'starting point':'arrival point'}.</p>}
        </div>
        {mapError&&<p className="cp-muted">Some map tiles could not load. Check your connection if the map is blank.</p>}
        {destination&&<><div className="fj-start-actions"><button className="cp-button cp-button-primary" onClick={locate} disabled={locating}><LocateFixed size={16}/>{locating?'Finding your location…':'Use my location'}</button><button className="cp-button" onClick={chooseStart}><MapPin size={16}/>{origin?'Change starting point':'Pick start on map'}</button></div><details className="fj-coordinate-start"><summary>Enter starting coordinates</summary><form onSubmit={e=>{e.preventDefault();const lat=Number(startLat),lng=Number(startLng);if(startLat.trim()&&startLng.trim()&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){locationAttempt.current++;setLocating(false);setOrigin([lng,lat]);}else setError('Enter valid latitude and longitude.');}}><label>Latitude<input required inputMode="decimal" value={startLat} onChange={e=>setStartLat(e.target.value)}/></label><label>Longitude<input required inputMode="decimal" value={startLng} onChange={e=>setStartLng(e.target.value)}/></label><button className="cp-button" type="submit">Find walking route</button></form></details></>}
      </>}
      {routing&&<p role="status">Finding a route along mapped streets and footpaths…</p>}
      {error&&<p role="alert" className="cp-error">{error} {!location&&<button onClick={()=>{setLoading(true);setError('');setRetry(v=>v+1);}} className="cp-text-button">Retry</button>}</p>}
      {routeError&&<p role="alert" className="cp-error">{routeError} <button className="cp-text-button" onClick={()=>setRouteAttempt(v=>v+1)}>Retry route</button></p>}
      {route&&<section className="fj-route-result"><h3>{route.minutes} min walk <span>{route.distanceKm.toFixed(2)} km</span></h3><p className="cp-muted">Estimate on mapped paths. Dashed connections to the path are unverified ({route.startOffsetM} m at the start, {route.endOffsetM} m at arrival).</p><ol>{route.steps.map((s,i)=><li key={i}><span>{s.name}</span><small>{Math.round(s.distanceM)} m</small></li>)}</ol></section>}
      <p className="fj-route-footnote">Your starting point is used for this route and is not saved to your profile. Routes use mapped walking access; confirm the actual entrance with the club.</p>
    </div>
  </section></div>,document.body);
}
