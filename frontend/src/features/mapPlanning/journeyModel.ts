import type { FamilyItinerary, FamilyLocation, PlanDraft } from './api';

export interface JourneyStep { id:string;number:number;title:string;kind:string;startsAt:string;endsAt:string;day:string;place:FamilyLocation|null }
export interface JourneyMapState { key:string;steps:JourneyStep[];selected:string|null;onSelect:(id:string)=>void;overview:number;nearby:boolean }
const dayKey=(value:string,zone:string)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'Date to be confirmed';
export function journeySteps(itinerary:FamilyItinerary):JourneyStep[] {
    const ordered=itinerary.activities.map((activity,index)=>({...activity,index})).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)||a.index-b.index);
    const steps:JourneyStep[]=ordered.map((a,index)=>({id:`activity:${a.index}`,number:index+1,title:a.title,kind:a.kind,startsAt:a.startsAt,endsAt:a.endsAt,day:dayKey(a.startsAt,itinerary.timezone),place:a.place}));
    const same=(a:FamilyLocation|null|undefined,b:FamilyLocation)=>a?.latitude===b.latitude&&a.longitude===b.longitude;
    const add=(role:string,title:string,time:string,front=false)=>{
        const place=itinerary.locations?.[role];if(!place)return;
        if((front&&same(steps[0]?.place,place))||(!front&&same(steps.at(-1)?.place,place)))return;
        const step={id:`role:${role}`,number:0,title,kind:role==='destination'?'ACTIVITY':'TRAVEL',startsAt:time,endsAt:time,day:dayKey(time,itinerary.timezone),place};
        if(front)steps.unshift(step);else steps.push(step);
    };
    add('meeting','Meet the team',itinerary.startsAt,true);
    const destination=itinerary.locations?.destination;
    if(destination&&!steps.some(s=>same(s.place,destination)))add('destination','Destination',itinerary.endsAt);
    add('collection','Return and collection',itinerary.endsAt);
    return steps.map((step,index)=>({...step,number:index+1}));
}
export function draftItinerary(draft:PlanDraft):FamilyItinerary {
    const publicPlace=(p:PlanDraft['places'][number])=>({name:p.name,address:p.address,latitude:p.latitude,longitude:p.longitude,photoUrl:p.photoUrl});
    return {title:draft.title,timezone:draft.timezone,startsAt:draft.startsAt,endsAt:draft.endsAt,destination:draft.destination,meetingPoint:draft.meetingPoint,collectionPoint:draft.collectionPoint,supervisionContact:draft.supervisionContact,message:draft.familyMessage,
        locations:Object.fromEntries(draft.places.filter(p=>/^plan:(meeting|destination|collection)$/.test(p.key)).map(p=>[p.key.slice(5),publicPlace(p)])),
        activities:draft.activities.map(a=>({title:a.title,kind:a.kind,startsAt:a.startsAt,endsAt:a.endsAt,place:draft.places.find(p=>p.key===a.placeKey)?publicPlace(draft.places.find(p=>p.key===a.placeKey)!):null})),
        arrangements:draft.arrangements.map(a=>({kind:a.kind,title:a.title,place:draft.places.find(p=>p.key===a.placeKey)?.name||''}))};
}
/** Co-located activities share one map pin but retain every timeline number. */
export function journeyGeometry(steps:JourneyStep[],selected:string|null) {
    const groups=new Map<string,JourneyStep[]>();
    steps.forEach(s=>{if(!s.place)return;const key=`${s.place.longitude},${s.place.latitude}`;groups.set(key,[...(groups.get(key)||[]),s]);});
    const pins={type:'FeatureCollection' as const,features:[...groups.values()].map(group=>{
        const active=group.find(s=>s.id===selected),step=active||group[0],place=step.place!;
        return {type:'Feature' as const,properties:{stepId:step.id,name:place.name,numbers:group.length>3?`${group[0].number}–${group.at(-1)!.number}`:group.map(s=>s.number).join('·'),active:Boolean(active)},geometry:{type:'Point' as const,coordinates:[place.longitude,place.latitude]}};
    })};
    const legs:({type:'Feature';properties:{active:boolean;number:string;stepId:string};geometry:{type:'LineString';coordinates:number[][]}})[]=[];
    const connections=new Map<string,typeof legs[number]>();
    // An unlocated activity breaks the path; never invent its location or bridge across it.
    for(let i=1;i<steps.length;i++){
        const a=steps[i-1],b=steps[i];if(!a.place||!b.place||a.place.latitude===b.place.latitude&&a.place.longitude===b.place.longitude)continue;
        const end=a.place.longitude+((b.place.longitude-a.place.longitude+540)%360-180);
        const coordinates=[[a.place.longitude,a.place.latitude],[end,b.place.latitude]];
        const key=[`${a.place.longitude},${a.place.latitude}`,`${b.place.longitude},${b.place.latitude}`].sort().join('|'),existing=connections.get(key);
        if(existing){existing.properties.number+=` / ${a.number} → ${b.number}`;if(b.id===selected){existing.properties.active=true;existing.properties.stepId=b.id;}}
        else {const leg={type:'Feature' as const,properties:{active:b.id===selected,stepId:b.id,number:`${a.number} → ${b.number}`},geometry:{type:'LineString' as const,coordinates}};connections.set(key,leg);legs.push(leg);}
    }
    return {pins,legs:{type:'FeatureCollection' as const,features:legs}};
}

/** Fit the narrowest longitude interval, including journeys crossing the date line. */
export function journeyBounds(points:[number,number][]):[[number,number],[number,number]] {
    const longitudes=points.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);
    let gap=-1,start=longitudes[0];
    longitudes.forEach((n,i)=>{const next=i===longitudes.length-1?longitudes[0]+360:longitudes[i+1];if(next-n>gap){gap=next-n;start=next%360;}});
    const lng=longitudes.map(n=>n<start?n+360:n),lat=points.map(p=>p[1]);
    return [[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]];
}
