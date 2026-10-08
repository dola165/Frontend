import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { ArrowLeft,ArrowRight,CalendarDays,Check,Compass,Flag,MapPin,Pause,Play,RefreshCw,Route,ShieldCheck,Users,X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FamilyPlanWindow } from './FamilyPlanWindow';
import { PublishedJourney } from './FamilyPlans';
import { PlacePhoto } from './PlacePhoto';
import { SmoothSelect } from './SmoothSelect';
import { dateTime,type FamilyItinerary,type FamilyPlan,type PlanPlace } from './api';
import { journeySteps,type JourneyMapState } from './journeyModel';
import './trip-view.css';

export function JourneyExplorer({itinerary,journeyKey,clubName,version,preview=false,publication=false,person,choices,onChoose,onMap,onDetailsAction,busy=false,onFocus,onExit,onResponsibilities,onRefresh,error,onPreviewSource}:{itinerary:FamilyItinerary;journeyKey:string;clubName:string;version:number;preview?:boolean;publication?:boolean;person?:FamilyPlan;choices?:FamilyPlan[];onChoose?:(id:string)=>void;onMap?:(state:JourneyMapState|null)=>void;onDetailsAction?:(fn:()=>Promise<unknown>)=>Promise<void>;busy?:boolean;onFocus?:(place:PlanPlace)=>void;onExit?:()=>void;onResponsibilities?:()=>void;onRefresh?:()=>void;error?:string;onPreviewSource?:(source:string)=>void}) {
    const steps=useMemo(()=>journeySteps(itinerary),[itinerary]);
    const [selection,setSelection]=useState<{journey:string;id:string|null}>({journey:journeyKey,id:null}),[playing,setPlaying]=useState(false),[overview,setOverview]=useState(0),[nearby,setNearby]=useState(false),[details,setDetails]=useState(false),[day,setDay]=useState('all'),[phoneDetail,setPhoneDetail]=useState(false);
    const selected=selection.journey===journeyKey?selection.id:null,current=steps.find(s=>s.id===selected)||null;
    const select=useCallback((id:string)=>{setSelection({journey:journeyKey,id});setPhoneDetail(true);},[journeyKey]);
    const mapCallback=useRef(onMap),element=useRef<HTMLDivElement>(null);useEffect(()=>{mapCallback.current=onMap;},[onMap]);
    useEffect(()=>{const frame=requestAnimationFrame(()=>{for(const part of ['.trip-stop-list','.trip-timeline'])element.current?.querySelector(`${part} button[aria-current]`)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});return()=>cancelAnimationFrame(frame);},[selected]);
    useEffect(()=>{onMap?.({key:journeyKey,steps,selected,onSelect:select,overview,nearby});},[onMap,journeyKey,steps,selected,select,overview,nearby]);
    useEffect(()=>()=>mapCallback.current?.(null),[]);
    useEffect(()=>{if(!playing||!steps.length)return;const timeout=setTimeout(()=>{const index=steps.findIndex(s=>s.id===selected);if(index>=steps.length-1){setPlaying(false);return;}select(steps[index+1].id);},4000);return()=>clearTimeout(timeout);},[playing,selected,steps,select]);
    useEffect(()=>{const stop=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',stop);return()=>document.removeEventListener('visibilitychange',stop);},[]);
    const days=[...new Set(steps.map(s=>s.day))],visible=day==='all'?steps:steps.filter(s=>s.day===day||s.id===selected);
    const showAll=()=>{setPlaying(false);setSelection({journey:journeyKey,id:null});setOverview(n=>n+1);setPhoneDetail(false);};
    const move=(direction:number)=>{setPlaying(false);const i=steps.findIndex(s=>s.id===selected);select(steps[Math.max(0,Math.min(steps.length-1,i+direction))].id);};
    const showMap=()=>{if(!current?.place)return;onFocus?.({...current.place,key:current.id,type:'MANUAL',notes:''});};
    const colocated=current?.place?steps.filter(s=>s.place?.latitude===current.place!.latitude&&s.place.longitude===current.place!.longitude):[];
    const arrangements=(itinerary.arrangements||[]).filter(a=>!current||!a.place||a.place.includes(current.place?.name||'\0'));
    const overviewPhoto=steps.find(s=>s.place?.photoUrl)?.place;
    return <div ref={element} className={`trip-explorer ${preview?'trip-explorer--preview':''}`}>
        <aside className="trip-rail" aria-label="Journey stops">
            <div className="trip-heading"><span className="atlas-eyebrow">{preview?'COACH PREVIEW':`SHARED BY ${clubName}`}</span><h2>{itinerary.title||'Your football journey'}</h2><p>{dateTime(itinerary.startsAt,itinerary.timezone)} · {itinerary.timezone}</p><div className="trip-stats"><span><MapPin size={13}/>{steps.filter(s=>s.place).length} stops</span><span><CalendarDays size={13}/>{days.length||1} {days.length===1?'day':'days'}</span><span><ShieldCheck size={13}/>{publication||person?`Version ${version}`:'Draft preview'}</span></div>
                {!!choices?.length&&onChoose&&<label className="mp-field"><span>Your journeys</span><SmoothSelect value={person?.id||choices[0].id} onChange={e=>{setPlaying(false);setDay('all');onChoose(e.target.value);}}>{choices.map(p=><option key={p.id} value={p.id}>{p.title} · {p.child_name}</option>)}</SmoothSelect></label>}
                <div className="mp-actions"><button className="mp-secondary" onClick={showAll}><Compass size={14}/>Whole journey</button>{person&&<button className="mp-primary" onClick={()=>setDetails(true)}><Check size={14}/>{person.viewer==='PLAYER'?'Read & reply':'Read & permission'}</button>}{preview&&onExit&&<button className="mp-link" onClick={onExit}><ArrowLeft size={14}/>Back to planning</button>}</div>
                {onRefresh&&<button className="mp-link" aria-label="Refresh your journeys" onClick={onRefresh}><RefreshCw size={13}/>Refresh journey</button>}{error&&<p role="alert" className="mp-alert">{error}</p>}
                {preview&&onPreviewSource&&<label className="mp-field"><span>Viewing</span><SmoothSelect value={publication?"journey":"draft"} onChange={e=>onPreviewSource(e.target.value)}><option value="journey">Published journey</option><option value="draft">Current draft preview</option></SmoothSelect></label>}{preview&&<p className="trip-preview-note">{publication?'The published version your families can see.':'Preview of the current draft. Families see the last published version.'} Editing and personal responses are off.</p>}
            </div>
            <div className="trip-stop-scroll">{days.length>1&&<div className="trip-days" aria-label="Journey days"><button aria-pressed={day==='all'} onClick={()=>setDay('all')}>All days</button>{days.map(d=><button key={d} aria-pressed={day===d} onClick={()=>setDay(d)}>{d}</button>)}</div>}
                {!steps.length&&<p className="trip-empty">Your schedule has no stops yet. Add activities and choose their places in planning.</p>}
                <ol className="trip-stop-list">{visible.map(s=><li key={s.id}><button className={s.id===selected?'is-selected':''} aria-current={s.id===selected?'step':undefined} onClick={()=>{setPlaying(false);select(s.id);}}><span className="trip-number">{s.number}</span><span className="trip-stop-text"><small>{dateTime(s.startsAt,itinerary.timezone)} · {s.kind.toLowerCase()}</small><strong>{s.title}</strong><span>{s.place?.name||'Place to be confirmed'}</span></span><PlacePhoto compact url={s.place?.photoUrl} name={s.place?.name||s.title}/></button></li>)}</ol>
            </div>
            <footer className="trip-rail-footer"><Route size={14}/><p>Select a stop on the map or timeline.<br/>Lines connect planned stops, not road directions.</p></footer>
            {onResponsibilities&&<div className="trip-support"><Link className="mp-link" to="/calendar">Open Schedule <ArrowRight size={13}/></Link><button className="mp-link" onClick={onResponsibilities}>Review my club responsibilities <ArrowRight size={13}/></button></div>}
        </aside>
        <div className="trip-map-tools"><button className="mp-secondary" onClick={showAll}><Compass size={15}/>Whole journey</button><button className="mp-secondary" disabled={!steps.length} aria-pressed={playing} onClick={()=>{if(!playing&&(selected===null||selected===steps.at(-1)?.id))select(steps[0].id);setPlaying(v=>!v);}}>{playing?<Pause size={15}/>:<Play size={15}/>}<span>{playing?'Pause tour':'Play journey'}</span></button><button className="mp-secondary" aria-pressed={nearby} onClick={()=>setNearby(v=>!v)}><Users size={15}/><span>Nearby football</span></button></div>
        <aside className={`trip-detail ${phoneDetail?'trip-detail--open':''}`} aria-label="Selected journey stop">
            <div className="trip-detail-header"><span className="atlas-eyebrow">{current?`STOP ${String(current.number).padStart(2,'0')} / ${steps.length}`:'THE WHOLE JOURNEY'}</span><button className="mp-icon trip-phone-close" aria-label="Close stop details" onClick={()=>setPhoneDetail(false)}><X size={17}/></button></div>
            <div key={current?.id||'overview'} className="trip-detail-arrive"><PlacePhoto url={current?.place?.photoUrl||(!current?overviewPhoto?.photoUrl:undefined)} name={current?.place?.name||(!current?overviewPhoto?.name:undefined)||itinerary.destination||itinerary.title}/><div className="trip-detail-copy"><span className="trip-kind">{current?.kind.toLowerCase()||'Your team, on the move'}</span><h3>{current?.title||itinerary.title}</h3><p className="trip-place-name"><MapPin size={15}/>{current?.place?.name||itinerary.destination||'Places to be confirmed'}</p>{current&&<p className="trip-time">{dateTime(current.startsAt,itinerary.timezone)} — {dateTime(current.endsAt,itinerary.timezone)}</p>}{current?.place?.address&&<p>{current.place.address}</p>}
                {current&&!current.place&&<p className="trip-info">This activity has no map location yet. Ask your coach to confirm the place.</p>}
                {current?.place&&<button className="mp-link" onClick={showMap}><Compass size={14}/>Focus this place</button>}
                {!current&&<dl className="mp-facts"><dt>Meet</dt><dd>{itinerary.meetingPoint||'To be confirmed'}</dd><dt>Collect</dt><dd>{itinerary.collectionPoint||'To be confirmed'}</dd></dl>}
                {colocated.length>1&&<section className="trip-also"><h4>At this place</h4>{colocated.map(s=><button key={s.id} aria-current={s.id===selected?'step':undefined} onClick={()=>{setPlaying(false);select(s.id);}}><span>{s.number}</span><strong>{s.title}</strong><ArrowRight size={13}/></button>)}</section>}
                {!!arrangements.length&&<section className="trip-arrangements"><h4>Shared arrangements</h4>{arrangements.map((a,i)=><p key={i}><Flag size={13}/><span>{a.title}<small>{a.place}</small></span></p>)}</section>}
                {itinerary.message&&<section className="trip-message"><h4>From your club</h4><p>{itinerary.message}</p></section>}<section className="trip-contact"><ShieldCheck size={18}/><div><h4>Supervision contact</h4><p>{itinerary.supervisionContact||'To be confirmed'}</p></div></section>
                {person&&<button className="mp-primary" onClick={()=>setDetails(true)}>{person.viewer==='PLAYER'?'Read & reply to this journey':'Read & review travel permission'}</button>}
                {steps.length>0&&<nav className="trip-step-controls" aria-label="Step through journey"><button className="mp-secondary" disabled={steps.findIndex(s=>s.id===selected)<=0} onClick={()=>move(-1)}><ArrowLeft size={14}/>Previous</button><button className="mp-secondary" disabled={selected===steps.at(-1)?.id} onClick={()=>move(1)}>Next stop<ArrowRight size={14}/></button></nav>}
            </div></div>
        </aside>
        {!!steps.length&&<nav className="trip-timeline" aria-label="Journey timeline"><span className="trip-timeline-label">{current?`Stop ${current.number} of ${steps.length}`:'Your journey'}<small>{days.length>1?`${days.length} days`:'Day 1'}</small></span><div>{steps.map(s=><button key={s.id} aria-current={s.id===selected?'step':undefined} onClick={()=>{setPlaying(false);select(s.id);}}><span>{s.number}</span><strong>{s.title}</strong><small>{dateTime(s.startsAt,itinerary.timezone)}</small></button>)}</div></nav>}
        {person&&onDetailsAction&&<FamilyPlanWindow open={details} onClose={()=>setDetails(false)} title="Journey details">{error&&<p role="alert" className="mp-alert">{error}</p>}<PublishedJourney p={person} busy={busy} action={onDetailsAction} onFocus={onFocus}/></FamilyPlanWindow>}
    </div>;
}
