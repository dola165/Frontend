import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { FamilySchedule } from '../../src/features/parents/FamilySchedule';
import type { SquadSession, SquadEventPlan } from '../../src/features/squadCommunication/api';
import { apiClient } from '../../src/api/axiosConfig';
import i18n from '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';

const params=new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark',params.get('theme')!=='light');
void i18n.changeLanguage(params.get('lang')??'en');
const monday=new Date();monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));monday.setHours(12,0,0,0);
const at=(day:number,hour:number)=>{const d=new Date(monday);d.setDate(d.getDate()+day);d.setHours(hour,0,0,0);return d.toISOString();};
const squad={id:11,name:'Dinamo Youth A',academy_name:'FC Dinamo Tbilisi Academy',category:'U21',club_id:1,can_manage:true,unread_count:0};
const players=['Giorgi Beridze','Luka Maisuradze','Nika Kapanadze','Saba Mchedlishvili','Davit Kvaratskhelia','Andria Dolidze','Giga Chikovani','Levan Japaridze'].map((name,i)=>({id:41+i,name}));
const event=(id:number,title:string,day:number,hour:number,event_type:SquadSession['event_type'],extra:Partial<SquadSession>={}):SquadSession=>({id,title,event_type,starts_at:at(day,hour),ends_at:at(day,hour+1),location:'Academy training ground · Pitch 2',status:'SCHEDULED',revision:0,cancellation_reason:null,response_requested:true,description:'Bring boots, shin pads and water. Meet at the pitch 15 minutes before the start.',attendance:players.map((p,i)=>({...p,response:i<5?'GOING':i===5?'NOT_GOING':'UNANSWERED',active:true})),...extra});
let sessions:SquadSession[]=params.has('empty')?[]:[event(81,'Technical development',0,18,'TRAINING',{series_id:'training'}),event(82,'Video analysis & team briefing',1,17,'ACTIVITY'),event(83,'Match preparation',2,18,'TRAINING',{series_id:'training'}),event(84,'Friendly vs Iberia U21',4,19,'FRIENDLY',{location:'Dinamo Football Academy · Main pitch'}),event(85,'Recovery & mobility',5,10,'TRAINING',{status:'CANCELLED',cancellation_reason:'Moved to Monday'}),event(86,'Individual development review',2,17,'ACTIVITY',{response_requested:false})];
function dates(plan:SquadEventPlan){const start=new Date(plan.startsAt),end=new Date(plan.endsAt);if(!plan.repeat)return[{startsAt:plan.startsAt,endsAt:plan.endsAt}];const until=new Date(plan.repeat.endDate+'T23:59:59');const selected=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];const result=[];for(const d=new Date(start);d<=until;d.setDate(d.getDate()+1)){if(plan.repeat.daysOfWeek.includes(selected[d.getDay()] as never)){const finish=new Date(d.getTime()+end.getTime()-start.getTime());result.push({startsAt:d.toISOString(),endsAt:finish.toISOString()});}}return result;}
// This review runs the production components with isolated sample records. No account or service writes.
apiClient.defaults.adapter=async config=>{
    const path=config.url??'';const input=typeof config.data==='string'?JSON.parse(config.data):config.data;let data:unknown={};
    if(path.endsWith('/events/preview')){const items=dates(input);data={occurrences:items,participantCount:input.playerIds.length,notificationRecipients:input.playerIds.length,conflictingOccurrences:0,requestResponses:input.requestResponses};}
    else if(path.endsWith('/11/events')&&config.method==='post'){const plan=input as SquadEventPlan;const created=dates(plan).map((d,i)=>({...event(100+i,plan.title,0,18,plan.eventType),starts_at:d.startsAt,ends_at:d.endsAt,location:plan.location,description:plan.description,series_id:plan.repeat?'new-plan':null,response_requested:plan.requestResponses,attendance:players.filter(p=>plan.playerIds.includes(p.id)).map(p=>({...p,response:'UNANSWERED',active:true}))}));sessions=[...sessions,...created];data={planId:'new-plan',sessionIds:created.map(s=>s.id)};}
    else if(path.endsWith('/11/sessions'))data=sessions.filter(s=>!config.params?.from||(s.starts_at<config.params.to&&s.ends_at>config.params.from));
    else if(path.endsWith('/squad-communication/11'))data={...squad,players,coaches:[],can_assign_coach:true};
    else if(path.includes('/schedule/clubs/'))data={events:[]};
    else if(path.endsWith('/squads'))data=[squad];
    else if(path.includes('/changes/preview'))data={expected:[{id:81,revision:0},{id:83,revision:0}],eventCount:2,notificationDeliveries:16,affectedResponses:10,dates:[at(0,18),at(2,18)]};
    return{config,status:200,statusText:'OK',headers:{},data};
};
const style=document.createElement('style');style.textContent=`html,body,#root{margin:0;min-height:100%;background:var(--fc-page-bg);color:var(--fc-text-primary)}.review-shell{padding:18px 28px 28px;max-width:1800px;margin:auto}.review-banner{display:flex;align-items:center;justify-content:space-between;padding:12px 0 18px;border-bottom:1px solid var(--fc-border);gap:12px;font-size:12px;color:var(--fc-text-secondary)}.review-banner strong{font-size:22px;color:var(--fc-accent);letter-spacing:-1px}.review-banner a{padding:7px;border:1px solid var(--fc-border);border-radius:6px}.review-banner nav{display:flex;gap:8px;align-items:center}@media(max-width:600px){.review-shell{padding:10px 14px}.review-banner{flex-wrap:wrap}.review-banner nav{flex-wrap:wrap}.review-banner strong{font-size:19px}}`;document.head.appendChild(style);
createRoot(document.getElementById('root')!).render(<MemoryRouter><main className={`review-shell schedule-bounded-workspace ${params.get('theme')==='light'?'workspace-light':''}`}><div className="review-banner"><strong>GrassKickZ</strong><span>Schedule review · illustrative sample data</span><nav><a href="?">Dark</a><a href="?theme=light">Light</a><a href="?empty=1">Empty week</a><a href="?lang=ka">ქართული</a></nav></div><FamilySchedule squads={[squad]} initialDate={monday}/></main></MemoryRouter>);
