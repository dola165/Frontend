import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';
import { extractApiErrorMessage } from '../../utils/apiError';
import { planGet, type Plan, type PlanContext } from './api';
import { FamilyPlanWindow } from './FamilyPlanWindow';
import { SmoothSelect } from './SmoothSelect';
import './journey-schedule.css';

interface Preferences {template:string;mode:string;meetingPoint:string;latitude:number|null;longitude:number|null;travelMinutes:number|null;arrivalMinutes:number;loadingMinutes:number;recoveryMinutes:number;transportMinor:number;mealPerPlayerMinor:number;budgetMinor:number;supervisionContact:string}
const initial:Preferences={template:'AWAY_MATCH',mode:'MEET_AT_VENUE',meetingPoint:'',latitude:null,longitude:null,travelMinutes:null,arrivalMinutes:45,loadingMinutes:10,recoveryMinutes:20,transportMinor:0,mealPerPlayerMinor:0,budgetMinor:0,supervisionContact:''};
export function JourneyLauncher({eventId}:{eventId:number}){
 const navigate=useNavigate(),[contexts,setContexts]=useState<PlanContext[]>([]),[open,setOpen]=useState(false),[squad,setSquad]=useState(''),[prefs,setPrefs]=useState(initial),[revision,setRevision]=useState(0),[remember,setRemember]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();void planGet<PlanContext[]>('/context',c.signal).then(setContexts).catch(()=>{});return()=>c.abort();},[eventId]);
 const choices=contexts.flatMap(c=>c.events.filter(e=>e.id===eventId).flatMap(e=>c.squads.filter(s=>s.canEdit&&(s.id===e.challenger_squad_id||s.id===e.target_squad_id)).map(s=>({id:s.id,club:c.id,name:`${c.name} · ${s.name}`}))));
 const choice=choices.find(s=>String(s.id)===squad)??choices[0];
 const choiceId=choice?.id;
 useEffect(()=>{if(!open||!choiceId)return;const c=new AbortController();setLoading(true);setError('');void apiClient.get<{revision:number;preferences:Preferences}>(`/journeys/squads/${choiceId}/preferences`,{signal:c.signal}).then(r=>{setPrefs(r.data.preferences);setRevision(r.data.revision);}).catch(e=>{if(!c.signal.aborted)setError(extractApiErrorMessage(e,'Squad preferences could not load. Retry.'));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[open,choiceId]);
 const update=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setPrefs(p=>({...p,[key]:value}));
 const start=async()=>{if(!choice||busy||loading)return;setBusy(true);setError('');try{
  if(remember)await apiClient.put(`/journeys/squads/${choice.id}/preferences`,{revision,preferences:prefs});
  const r=await apiClient.post<Plan>('/journeys/from-fixture',{eventId,clubId:choice.club,squadId:choice.id,preferences:prefs},{timeout:25000});
  navigate(`/map?plans=staff&plan=${r.data.id}&club=${choice.club}&squad=${choice.id}`);
 }catch(e){setError(extractApiErrorMessage(e,'The journey could not open. Retry safely; this fixture reuses its existing draft.'));}finally{setBusy(false);}};
 if(!choice)return null;
 return <><button type="button" className="mx-button journey-launch" onClick={()=>setOpen(true)}><Route size={16}/> Plan team travel</button><FamilyPlanWindow className="journey-floating-window" open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Plan team travel"><form className="journey-event-details" onSubmit={e=>{e.preventDefault();void start();}}>
 <h2>From fixture to journey.</h2><p>Use the agreed match details, then review your stops, participants and costs on the map. Reopening this action returns to the same plan.</p>
 <label>Planning squad<SmoothSelect value={choice.id} onChange={e=>setSquad(e.target.value)}>{choices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</SmoothSelect></label>
 {loading?<p role="status">Loading squad preferences…</p>:<fieldset disabled={busy} style={{display:'grid',gap:16}}>
 <label>Journey template<SmoothSelect value={prefs.template} onChange={e=>setPrefs(p=>({...p,template:e.target.value,arrivalMinutes:e.target.value==='TRAINING_DAY'?30:e.target.value==='TOURNAMENT_DAY'?60:45,recoveryMinutes:e.target.value==='TRAINING_DAY'?15:e.target.value==='TOURNAMENT_DAY'?30:20}))}><option value="AWAY_MATCH">Away match</option><option value="TRAINING_DAY">Training day</option><option value="TOURNAMENT_DAY">Tournament day</option></SmoothSelect></label>
 <label>How do you meet?<SmoothSelect value={prefs.mode} onChange={e=>update('mode',e.target.value)}><option value="MEET_AT_VENUE">Meet at the match venue</option><option value="TRAVEL_TOGETHER">Gather and travel together</option></SmoothSelect></label>
 {prefs.mode==='TRAVEL_TOGETHER'&&<><label>Gathering and collection place<input required value={prefs.meetingPoint} placeholder="Academy entrance" onChange={e=>update('meetingPoint',e.target.value)}/></label><label>Estimated travel each way · minutes<input type="number" min={1} max={1440} required value={prefs.travelMinutes??''} onChange={e=>update('travelMinutes',e.target.value?Number(e.target.value):null)}/></label><small>Enter your own travel estimate. You can select the gathering point on the map after opening the draft.</small></>}
 <label>Arrive before kickoff · minutes<input type="number" min={0} max={240} value={prefs.arrivalMinutes} onChange={e=>update('arrivalMinutes',Number(e.target.value))}/></label>
 <label>Gathering buffer · minutes<input type="number" min={0} max={120} value={prefs.loadingMinutes} onChange={e=>update('loadingMinutes',Number(e.target.value))}/></label>
 <label>Recovery after the match · minutes<input type="number" min={0} max={240} value={prefs.recoveryMinutes} onChange={e=>update('recoveryMinutes',Number(e.target.value))}/></label>
 <label>Meal estimate per player · club currency<input type="number" min={0} step="0.01" value={prefs.mealPerPlayerMinor/100} onChange={e=>update('mealPerPlayerMinor',Math.round(Number(e.target.value)*100))}/></label><label>Transport estimate · club currency<input type="number" min={0} step="0.01" value={prefs.transportMinor/100} onChange={e=>update('transportMinor',Math.round(Number(e.target.value)*100))}/></label><label>Proposed budget limit · club currency<input type="number" min={0} step="0.01" value={prefs.budgetMinor/100} onChange={e=>update('budgetMinor',Math.round(Number(e.target.value)*100))}/></label>
 <label>Supervision contact<input value={prefs.supervisionContact} onChange={e=>update('supervisionContact',e.target.value)}/></label>
 <label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Save these preferences for this squad</label>
 </fieldset>}
 {error&&<p role="alert">{error}</p>}<button type="submit" className="journey-event-open" disabled={busy||loading}>{busy?'Opening journey…':'Review journey on the map'}</button><small>Private until you publish. A pending challenge remains provisional. Costs are estimates; booking and approval stay separate.</small>
 </form></FamilyPlanWindow></>;
}
