import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import type { ScheduleWorkspaceEvent } from '../../components/schedule/workspaceTypes';
import { extractApiErrorMessage } from '../../utils/apiError';
import type { FamilyItinerary, FamilyLocation } from './api';

export interface JourneyEntry {
 id:string;planId:number;activityKey:string;version:number;clubId:number;squadId:number;squadName:string;clubName:string;
 journeyTitle:string;timezone:string;title:string;kind:string;startsAt:string;endsAt:string;status:string;sourceChanged:boolean;
 place:FamilyLocation|null;eventId:number|null;sessionId:number|null;staff:boolean;itinerary:FamilyItinerary;
 subjects:{id:number;name:string;guardian:boolean;canRespond:boolean;response:string}[];
 attendance:{total:number;going:number;pending:number};replyScope:string;
}
export const JOURNEY_REFRESH = 'grasskickz:journey-response';
export function useJourneyEntries(from:string,to:string,revision=0,childId?:number,squadId?:number){
 const [state,setState]=useState<{key:string;entries:JourneyEntry[];error:string;loading:boolean}>({key:'',entries:[],error:'',loading:true});
 const key=`${from}:${to}:${childId??''}:${squadId??''}`;
 useEffect(()=>{const c=new AbortController();let running=false;
  const load=async()=>{if(running||c.signal.aborted)return;running=true;try{const r=await apiClient.get<JourneyEntry[]>('/journeys/schedule',{params:{from:new Date(from).toISOString(),to:new Date(to).toISOString(),childId,squadId},signal:c.signal});if(!c.signal.aborted)setState({key,entries:r.data,error:'',loading:false});}catch(e){if(!c.signal.aborted)setState({key,entries:[],error:extractApiErrorMessage(e,'Journey activities could not load. Refresh to try again.'),loading:false});}finally{running=false;}};
  void load();const refresh=()=>{if(!document.hidden)void load();};const timer=setInterval(refresh,15000);window.addEventListener(JOURNEY_REFRESH,refresh);window.addEventListener('focus',refresh);
  return()=>{c.abort();clearInterval(timer);window.removeEventListener(JOURNEY_REFRESH,refresh);window.removeEventListener('focus',refresh);};
 },[key,from,to,revision,childId,squadId]);return state.key===key?state:{entries:[],error:'',loading:true};
}
export function mergeJourneyEntries<T extends ScheduleWorkspaceEvent>(events:T[],entries:JourneyEntry[]):(T & {journeys?:JourneyEntry[]})[]{
 const result=events.map(e=>({...e,journeys:[] as JourneyEntry[]}));
 for(const j of entries){const existing=result.find(e=>j.sessionId!=null?e.origin==='SQUAD_SESSION'&&e.eventId===j.sessionId:j.eventId!=null&&e.origin!=='SQUAD_SESSION'&&e.eventId===j.eventId);
  if(existing){existing.journeys.push(j);if(j.status==='CANCELLED')existing.status='CANCELLED';continue;}
  result.push({id:j.id,eventId:-(j.planId*1000),origin:'JOURNEY',title:j.title,subtitle:`${j.journeyTitle} · ${j.kind.toLowerCase()}`,eventType:j.kind==='MATCH'?'MATCH':j.kind==='TRAINING'?'TRAINING':'ACTIVITY',startsAt:j.startsAt,endsAt:j.endsAt,locationText:j.place?.name,status:j.status,visibility:'CLUB_ONLY',publicationState:'PRIVATE',recurring:false,ownerLabel:j.squadName,hostSquadId:j.squadId,hostSquadName:j.squadName,mapEligible:false,appearsOnMap:false,conflictingEventIds:[],journeys:[j]} as unknown as T & {journeys:JourneyEntry[]});
 }
 return result.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
}
export async function replyToJourney(entry:JourneyEntry,subjectId:number,response:'GOING'|'NOT_GOING'){
 await apiClient.post(`/journeys/${entry.planId}/reply`,{version:entry.version,subjectId,response},{timeout:20000});window.dispatchEvent(new Event(JOURNEY_REFRESH));
}
