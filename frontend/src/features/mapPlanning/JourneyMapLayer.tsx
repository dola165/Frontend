import { visualColors } from '../../styles/visualColors';
import { useEffect,useMemo,useRef } from 'react';
import { Layer,Source,useMap } from 'react-map-gl/maplibre';
import { journeyGeometry,journeyBounds,type JourneyMapState } from './journeyModel';

export function JourneyMapLayer({state}:{state:JourneyMapState}) {
    const {current:map}=useMap(),camera=useRef('');
    const geometry=useMemo(()=>journeyGeometry(state.steps,state.selected),[state.steps,state.selected]);
    useEffect(()=>{
        if(!map)return;let done=false;
        const update=()=>{
            if(done||!map.isStyleLoaded())return;done=true;
            const signature=`${state.key}:${state.selected}:${state.overview}`;if(camera.current===signature)return;
            if(!camera.current)map.getMap().setPadding({top:0,bottom:0,left:0,right:0});camera.current=signature;
            const duration=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:800;
            const selected=state.steps.find(s=>s.id===state.selected),points=state.steps.flatMap(s=>s.place?[[s.place.longitude,s.place.latitude] as [number,number]]:[]);
            map.getMap().setTerrain(null);map.getMap().setProjection({type:'mercator'});
            const phone=window.innerWidth<768;
            if(selected?.place){map.easeTo({center:[selected.place.longitude,selected.place.latitude],zoom:Math.min(14,Math.max(map.getZoom(),13)),pitch:0,bearing:0,duration,offset:[0,phone?-Math.min(160,map.getContainer().clientHeight*.17):-40]});}
            else if(!state.selected&&points.length){
                const framing=map.cameraForBounds(journeyBounds(points),{maxZoom:13.5,bearing:0,padding:{top:phone?380:95,bottom:160,left:55,right:55}});
                if(framing)map.easeTo({...framing,duration,pitch:0,bearing:0});
            }
        };
        update();map.on('idle',update);return()=>{map.off('idle',update);};
    },[map,state.key,state.selected,state.overview,state.steps]);
    return <>
        <Source id="journey-connections" type="geojson" data={geometry.legs}>
            <Layer id="journey-connection-underlay" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':visualColors.routeHalo,'line-width':7,'line-opacity':.85}}/>
            <Layer id="journey-connection-line" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':['case',['get','active'],visualColors.routeActive,visualColors.routeInactive],'line-width':['case',['get','active'],4,2.5],'line-dasharray':[2,2],'line-opacity':.95}}/>
            <Layer id="journey-connection-label" type="symbol" layout={{'symbol-placement':'line-center','text-field':['get','number'],'text-font':['Noto Sans Regular'],'text-size':12,'text-allow-overlap':true,'text-ignore-placement':true}} paint={{'text-color':visualColors.mapForest,'text-halo-color':visualColors.mapPaper,'text-halo-width':3}}/>
        </Source>
        <Source id="journey-stops" type="geojson" data={geometry.pins}>
            <Layer id="journey-stop-shadow" type="circle" paint={{'circle-radius':['case',['get','active'],30,26],'circle-color':visualColors.mapShadow,'circle-blur':.8,'circle-opacity':.2,'circle-translate':[0,4]}}/>
            <Layer id="journey-stop-pin" type="circle" paint={{'circle-radius':['case',['get','active'],23,20],'circle-color':['case',['get','active'],visualColors.mapDestination,visualColors.mapPaper],'circle-stroke-color':['case',['get','active'],visualColors.routeHalo,visualColors.mapDestination],'circle-stroke-width':['case',['get','active'],4,2]}}/>
            <Layer id="journey-stop-number" type="symbol" layout={{'text-field':['get','numbers'],'text-font':['Noto Sans Regular'],'text-size':12,'text-allow-overlap':true,'text-ignore-placement':true}} paint={{'text-color':['case',['get','active'],visualColors.routeHalo,visualColors.mapForest]}}/>
            <Layer id="journey-stop-name" type="symbol" layout={{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,2.7],'text-anchor':'top','text-max-width':17}} paint={{'text-color':visualColors.mapForest,'text-halo-color':visualColors.mapPaper,'text-halo-width':3}}/>
        </Source>
    </>;
}
