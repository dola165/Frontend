import { useEffect, useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { ArrowUpRight, MapPin, Route, RefreshCw } from 'lucide-react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { planGet, dateTime, type FamilyPlan, type PlanPlace } from './api';
import { PublishedJourney } from './FamilyPlans';
import { journeyPlaces } from './publishedJourney';
import { FamilyPlanWindow } from './FamilyPlanWindow';
import { ResponsibilitiesWindow } from './ResponsibilitiesWindow';
import './planning.css';
import './journeys.css';
import { JourneyExplorer } from './JourneyExplorer';
import type { JourneyMapState } from './journeyModel';

/** A published journey is a commitment in its own right; no match or staff appointment is needed. */
export function MyJourneys({childId,onPlaces,onFocus,onJourney,workspace=false}:{childId?:number;onPlaces?:(places:PlanPlace[])=>void;onFocus?:(place:PlanPlace)=>void;onJourney?:(state:JourneyMapState|null)=>void;workspace?:boolean}) {
 const [params,setParams]=useSearchParams();
 const [items,setItems]=useState<FamilyPlan[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[selected,setSelected]=useState<string|null>(()=>new URLSearchParams(window.location.search).get('journey')),[busy,setBusy]=useState(false),[responsibilities,setResponsibilities]=useState(false);
 useEffect(()=>{const c=new AbortController();void planGet<FamilyPlan[]>('/family',c.signal).then(rows=>{if(!c.signal.aborted){setItems(rows);setError('');}}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Your journeys could not load.'));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[refresh]);
 const visible=items.filter(p=>!childId||p.child_id===childId).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
 const selection=workspace?params.get('journey'):selected;
 const journeyChild=workspace?params.get('journeyChild'):null;
 const picked=visible.find(p=>String(workspace?p.plan_id:p.id)===selection&&(!journeyChild||String(p.child_id)===journeyChild))||(workspace&&!selection?visible[0]:undefined);
 useEffect(()=>{if(!workspace||!onPlaces)return;const eligible=items.filter(p=>!childId||p.child_id===childId),current=eligible.find(p=>String(p.plan_id)===selection&&(!journeyChild||String(p.child_id)===journeyChild))||(!selection?eligible[0]:undefined);onPlaces(current?journeyPlaces(current):[]);},[items,selection,journeyChild,workspace,onPlaces,childId]);
 const choose=(id:string)=>{const next=visible.find(p=>String(p.id)===id);if(next)setParams(p=>{p.set('journey',String(next.plan_id));p.set('journeyChild',String(next.child_id));return p;});};
 const action=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await fn();setRefresh(n=>n+1);}catch(e){setError(extractApiErrorMessage(e,'Your reply was not saved. Please retry.'));}finally{setBusy(false);}};
 const open=(p:FamilyPlan)=>{if(workspace)choose(String(p.id));else setSelected(String(p.id));onPlaces?.(journeyPlaces(p));};
 if(workspace&&picked)return <><JourneyExplorer itinerary={picked.itinerary} journeyKey={`${picked.plan_id}:${picked.version}:${picked.child_id}`} clubName={picked.club_name} version={picked.version} person={picked} choices={visible} onChoose={choose} onMap={onJourney} onFocus={onFocus} onDetailsAction={action} busy={busy} error={error} onRefresh={()=>setRefresh(n=>n+1)} onResponsibilities={()=>setResponsibilities(true)}/><ResponsibilitiesWindow open={responsibilities} onClose={()=>setResponsibilities(false)}/></>;
 return <section className={`journey-space ${workspace?'journey-workspace':'journey-schedule'}`} aria-label="Your journeys">
   <header className="journey-heading"><div><span className="atlas-eyebrow">SHARED BY YOUR CLUB</span><h2>Your journeys</h2><p>Meet, travel and return together. Read the whole plan and reply here.</p></div><button className="mp-icon" aria-label="Refresh your journeys" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={17}/></button></header>
   {loading&&<p role="status">Loading your journeys…</p>}{error&&<p role="alert" className="mp-alert">{error}</p>}
   {!loading&&workspace&&selection&&!picked&&!error&&<p role="status">That journey is not available to you. Choose one of your current journeys below.</p>}
   {!loading&&!visible.length&&!error&&<p className="journey-empty">Your club's published journeys will appear here, including training days and trips without a match.</p>}
   <div className="journey-cards">{visible.map(p=><button className="journey-card" key={p.id} onClick={()=>open(p)} aria-haspopup="dialog"><Route size={22}/><span><small>{p.club_name} · {p.child_name}</small><strong>{p.title}</strong><span>{dateTime(p.itinerary.startsAt,p.itinerary.timezone)} · {p.itinerary.timezone}</span><span><MapPin size={12}/>{p.itinerary.destination||p.itinerary.meetingPoint}</span><em>{p.viewer==='PLAYER'?p.response?.status==='GOING'?"You're going":p.response?.status==='NOT_GOING'?"You're not going":'Read & reply':`Read & review permission${p.permission?.status?' · '+p.permission.status.toLowerCase():''}`}</em></span><ArrowUpRight size={17}/></button>)}</div>
   {workspace&&<div className="journey-support"><Link className="mp-link" to="/calendar">Open Schedule <ArrowUpRight size={14}/></Link><button className="mp-link" onClick={()=>setResponsibilities(true)}>Review my club responsibilities <ArrowUpRight size={14}/></button></div>}
   <FamilyPlanWindow open={Boolean(picked)} onClose={()=>setSelected(null)} title="Journey details">{picked&&<><p role="alert" className="mp-alert" hidden={!error}>{error}</p><PublishedJourney p={picked} busy={busy} action={action} onPlaces={onPlaces} onFocus={onFocus}/>{!workspace&&<Link className="mp-link journey-map-link" to={`/map?plans=family&journey=${picked.plan_id}&journeyChild=${picked.child_id}`}>Open journeys on the map <ArrowUpRight size={14}/></Link>}</>}</FamilyPlanWindow>
   <ResponsibilitiesWindow open={responsibilities} onClose={()=>setResponsibilities(false)}/>
 </section>;
}
