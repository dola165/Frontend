import { visualColors } from '../../styles/visualColors';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Layers, MapPin, Minus, Plus, RotateCcw } from 'lucide-react';
import { placeById, places } from './fixtures';
import type { Plan } from './model';
interface Props { plan:Plan; selected:string; day:string; discoveryIds:string[]; resetToken:number; focus:string; onSelect:(id:string)=>void; onBounds:(bounds:number[])=>void; fallback:boolean; onFallback:()=>void }
export function MapCanvas({plan,selected,day,discoveryIds,resetToken,focus,onSelect,onBounds,fallback,onFallback}:Props) {
  const container=useRef<HTMLDivElement>(null),map=useRef<LibreMap|null>(null),markers=useRef<maplibregl.Marker[]>([]);
  const select=useRef(onSelect);select.current=onSelect;
  const [loaded,setLoaded]=useState(false),[layerMenu,setLayerMenu]=useState(false),[discovery,setDiscovery]=useState(true),[pan,setPan]=useState({x:0,y:0}),[zoom,setZoom]=useState(1),[away,setAway]=useState(false);
  const pointer=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  const dayActivities=plan.draft.activities.filter(a=>a.day===day);
  const allStops=[...new Set(plan.draft.activities.map(a=>a.placeId))];
  const planned=dayActivities.map(a=>a.placeId);
  const visible=places.filter(p=>p.region===plan.region&&(allStops.includes(p.id)||(plan.incoming&&p.id==='new-ground')||(discovery&&discoveryIds.includes(p.id))));
  const pendingHost=!!plan.incoming&&['pending','requested'].includes(plan.incoming.status);
  const routes=dayActivities.filter(a=>a.journeyFrom).map(a=>({type:'Feature' as const,properties:{draft:plan.published?.revision!==plan.revision&&!pendingHost,proposal:false},geometry:{type:'LineString' as const,coordinates:[placeById(a.journeyFrom!).coords,placeById(a.placeId).coords]}}));
  if(day==='2027-06-16'&&plan.incoming&&['pending','requested'].includes(plan.incoming.status))routes.push({type:'Feature',properties:{draft:false,proposal:true},geometry:{type:'LineString',coordinates:[placeById('training').coords,placeById('new-ground').coords]}});
  useEffect(()=>{
    if(fallback||!container.current)return;
    let instance:LibreMap;
    const styleUrl=new URLSearchParams(location.search).has('no-tiles')?'/map-workspace-basemap-unavailable.json':'https://tiles.openfreemap.org/styles/dark';
    try {instance=new maplibregl.Map({container:container.current,style:styleUrl,center:plan.region==='Tallinn'?[24.85,59.43]:[44.815,41.757],zoom:11,pitch:0,attributionControl:{compact:true}});map.current=instance;}catch{onFallback();return;}
    let failures=0;
    instance.on('error',()=>{failures++;if(failures>3)onFallback();});
    instance.on('load',()=>{
      for(const layer of instance.getStyle().layers) {
        const id=layer.id.toLowerCase();
        if(layer.type==='background')instance.setPaintProperty(layer.id,'background-color',visualColors.mapCanvasPaint166);
        if(layer.type==='fill')instance.setPaintProperty(layer.id,'fill-color',/water/.test(id)?visualColors.mapCanvasPaint167:/wood|forest|park|grass/.test(id)?visualColors.mapCanvasPaint168:/building/.test(id)?visualColors.mapCanvasPaint169:visualColors.mapCanvasPaint170);
        if(layer.type==='line')instance.setPaintProperty(layer.id,'line-color',/water/.test(id)?visualColors.mapCanvasPaint171:/boundary/.test(id)?visualColors.mapCanvasPaint172:/motorway|trunk|major/.test(id)?visualColors.mapCanvasPaint173:/casing/.test(id)?visualColors.mapCanvasPaint174:visualColors.mapCanvasPaint175);
        if(layer.type==='symbol'&&layer.layout?.['text-field']) {
          instance.setPaintProperty(layer.id,'text-color',/place/.test(id)?visualColors.mapCanvasPaint176:visualColors.mapCanvasPaint177);
          instance.setPaintProperty(layer.id,'text-halo-color',visualColors.mapCanvasPaint178);
          instance.setPaintProperty(layer.id,'text-halo-width',1.4);
        }
      }
      instance.addSource('demo-routes',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      instance.addLayer({id:'route-glow',type:'line',source:'demo-routes',paint:{'line-color':visualColors.mapCanvasPaint179,'line-opacity':.13,'line-width':12}});
      instance.addLayer({id:'route-line',type:'line',source:'demo-routes',filter:['all',['!', ['get','proposal']],['!', ['get','draft']]],paint:{'line-color':visualColors.mapCanvasPaint179,'line-width':3,'line-dasharray':[2,1]}});
      instance.addLayer({id:'route-draft',type:'line',source:'demo-routes',filter:['get','draft'],paint:{'line-color':visualColors.mapCanvasPaint180,'line-width':3,'line-dasharray':[4,2]}});
      instance.addLayer({id:'route-proposal',type:'line',source:'demo-routes',filter:['get','proposal'],paint:{'line-color':visualColors.mapCanvasPaint181,'line-width':3,'line-dasharray':[1,3]}});
      setLoaded(true);
    });
    instance.on('dragend',()=>setAway(true));
    instance.on('moveend',()=>{const b=instance.getBounds();onBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);});
    const timer=window.setTimeout(()=>{if(!instance.isStyleLoaded())onFallback();},12000);
    return ()=>{clearTimeout(timer);markers.current.forEach(m=>m.remove());markers.current=[];instance.remove();map.current=null;setLoaded(false);};
    // The geographic canvas persists across selections and panels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[fallback]);
  const fit=()=>{
    setPan({x:0,y:0});setZoom(1);setAway(false);
    if(!map.current)return;
    const ids=allStops.length?[...allStops]:places.filter(p=>p.region===plan.region).map(p=>p.id);
    if(plan.incoming&&!ids.includes('new-ground'))ids.push('new-ground');
    const bounds=new maplibregl.LngLatBounds();ids.forEach(id=>bounds.extend(placeById(id).coords));
    const mobile=window.innerWidth<700,workspace=container.current?.closest('.mw-workspace');
    const left=(workspace?.querySelector('.mw-left-rail')?.getBoundingClientRect().width??0)+40;
    const right=(workspace?.querySelector('.mw-right-panel')?.getBoundingClientRect().width??0)+40;
    map.current.fitBounds(bounds,{padding:{left:mobile?45:left,right:mobile?45:right,top:140,bottom:mobile?280:255},maxZoom:12,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550});
  };
  useEffect(()=>{if(loaded)fit();else{setPan({x:0,y:0});setZoom(1);}},[loaded,plan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{fit();},[resetToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(loaded&&!away&&plan.incoming?.status==='pending')fit();},[plan.incoming?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!loaded||!map.current)return;
    (map.current.getSource('demo-routes') as GeoJSONSource)?.setData({type:'FeatureCollection',features:routes});
    markers.current.forEach(m=>m.remove());markers.current=[];
    visible.forEach(p=>{
      const button=document.createElement('button');button.className=`mw-pin ${allStops.includes(p.id)?'planned':''} ${planned.includes(p.id)?'today':''} ${p.id===selected?'selected':''} ${plan.saved.includes(p.id)?'saved':''}`;
      button.setAttribute('aria-label',`Select ${p.name}`);button.title=p.name;button.dataset.place=p.id;
      button.innerHTML=`<span>${allStops.includes(p.id)?allStops.indexOf(p.id)+1:p.type==='stay'?'▤':p.type==='academy'?'⚑':p.type==='meeting'?'↗':'⚽'}</span>${(p.id===selected||planned.includes(p.id)||(pendingHost&&p.id==='new-ground'))?`<i>${p.name.replace(' Training Ground','').replace(' Match Ground','').replace(' Team Lodge','')}${pendingHost&&p.id==='new-ground'?' · proposed':''}</i>`:''}`;
      button.onclick=()=>select.current(p.id);
      markers.current.push(new maplibregl.Marker({element:button,anchor:'center'}).setLngLat(p.coords).addTo(map.current!));
    });
  },[loaded,selected,plan,day,discoveryIds.join(','),discovery]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!focus)return;
    const p=placeById(focus);if(p&&map.current&&loaded){const mobile=window.innerWidth<700,workspace=container.current?.closest('.mw-workspace');map.current.easeTo({center:p.coords,padding:{left:mobile?30:(workspace?.querySelector('.mw-left-rail')?.getBoundingClientRect().width??0)+40,right:mobile?30:(workspace?.querySelector('.mw-right-panel')?.getBoundingClientRect().width??0)+40,top:100,bottom:mobile?270:245},duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350});setAway(false);}
  },[focus,loaded]);
  const project=(coords:number[])=>plan.region==='Tallinn'?[(coords[0]-24.55)/.58*1000,(59.53-coords[1])/.23*700]:[(coords[0]-44.72)/.2*1000,(41.82-coords[1])/.14*700];
  return <div className={`mw-map ${fallback?'offline':''}`} aria-label="Interactive plan map">
    {!fallback&&<div ref={container} className="mw-map-engine"/>}
    {fallback&&<div className="mw-fallback" onPointerDown={e=>{if((e.target as Element).closest('button'))return;pointer.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(pointer.current){setPan({x:pointer.current.panX+e.clientX-pointer.current.x,y:pointer.current.panY+e.clientY-pointer.current.y});setAway(true);}}} onPointerUp={()=>pointer.current=null}>
      <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Approximate regional fallback map with planned journeys"><defs><pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke={visualColors.paper} strokeOpacity=".025"/></pattern></defs><rect width="1000" height="700" fill={visualColors.mapCanvasPaint182}/><g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
      <path d={plan.region==='Tallinn'?'M0 245L105 249L174 296L285 284L327 322L389 286L439 203L501 200L527 141L568 115L610 170L650 199L696 103L722 45L765 12L803 146L850 198L899 140L1000 190V700H0Z':'M0 0H1000V700H0Z'} fill={visualColors.mapCanvasPaint183} stroke={visualColors.mapCanvasPaint184} strokeWidth="2"/>
      <path d="M0 504Q300 278 1000 389M15 600Q410 302 900 285M140 0Q540 490 430 700M0 352Q440 397 900 603" fill="none" stroke={visualColors.mapCanvasPaint185} strokeWidth="2" opacity=".4"/>
      <path d="M50 450L390 384L601 359L829 600M400 190L390 384L645 249L1000 275" fill="none" stroke={visualColors.mapCanvasPaint186} strokeWidth="4" opacity=".3"/>
      <rect width="1000" height="700" fill="url(#map-grid)"/>
      <text x="305" y="428" className="geo-city">{plan.region==='Tallinn'?'TALLINN':'TBILISI'}</text><text x="400" y="77" className="geo-water">{plan.region==='Tallinn'?'TALLINN BAY':'MTKVARI REGION'}</text><text x="753" y="250" className="geo-district">{plan.region==='Tallinn'?'Viimsi':'Gldani'}</text><text x="790" y="580" className="geo-district">{plan.region==='Tallinn'?'Rae':'Dighomi'}</text>
      {routes.map((r,i)=>{const from=project(r.geometry.coordinates[0]),to=project(r.geometry.coordinates[1]);return <path key={i} d={`M${from}L${to}`} stroke={r.properties.proposal?visualColors.mapCanvasPaint181:r.properties.draft?visualColors.mapCanvasPaint180:visualColors.mapCanvasPaint187} strokeWidth="3" strokeDasharray={r.properties.proposal?'3 9':r.properties.draft?'12 6':'7 5'} fill="none"/>;})}
      {visible.map(p=>{const [x,y]=project(p.coords);return <foreignObject key={p.id} x={x-20} y={y-20} width="190" height="60" overflow="visible"><button aria-label={`Select ${p.name}`} className={`mw-pin ${allStops.includes(p.id)?'planned':''} ${planned.includes(p.id)?'today':''} ${p.id===selected?'selected':''} ${plan.saved.includes(p.id)?'saved':''}`} onClick={()=>onSelect(p.id)}><span>{allStops.includes(p.id)?allStops.indexOf(p.id)+1:p.type==='stay'?'▤':'⚑'}</span>{(p.id===selected||planned.includes(p.id))&&<i>{p.name.replace(' Training Ground','').replace(' Match Ground','')}</i>}</button></foreignObject>;})}</g></svg>
    </div>}
    <div className="mw-map-caption"><span className="live-dot"/>{plan.region==='Tallinn'?'Tallinn & the north coast':'Tbilisi · local football'}<small>{fallback?'Offline illustration':'Regional map'} · demo locations</small></div>
    <div className="mw-map-tools"><button aria-label="Zoom in" onClick={()=>map.current?map.current.zoomIn():setZoom(z=>Math.min(z+.2,2.5))}><Plus size={19}/></button><button aria-label="Zoom out" onClick={()=>map.current?map.current.zoomOut():setZoom(z=>Math.max(z-.2,.6))}><Minus size={19}/></button><button aria-label="Fit plan" title="Fit plan" onClick={fit}><Crosshair size={19}/></button><button aria-label="Map layers" title="Map layers" onClick={()=>setLayerMenu(!layerMenu)}><Layers size={19}/></button></div>
    {layerMenu&&<div className="mw-layer-menu"><strong>Map layers</strong><label><input type="checkbox" checked={discovery} onChange={e=>setDiscovery(e.target.checked)}/>Discovery places</label><p>Planned stops stay visible.</p><button onClick={onFallback}><MapPin size={15}/>Use offline map</button></div>}
    {away&&<button className="mw-return" onClick={fit}><RotateCcw size={14}/>Return to plan</button>}
    <div className="mw-route-label">{pendingHost?'Dotted: proposal · dashed: published':plan.published?.revision!==plan.revision?'Long dashes: draft journeys':'Dashed: published journeys'} · approximate, no live routing</div>
  </div>;
}
