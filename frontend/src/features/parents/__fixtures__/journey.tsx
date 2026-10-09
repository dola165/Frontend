/** Local preview of the real components. Every API call stays in this in-memory adapter. */
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../api/axiosConfig';
import { AuthProvider } from '../../../context/AuthContext';
import { setStoredAccessToken } from '../../../utils/authStorage';
import { applyDocumentTheme } from '../../../theme';
import i18n from '../../../i18n';
import { ParentHubPage } from '../../../pages/ParentHubPage';
import { WorkspacesPage } from '../../../components/layout/WorkspacesPage';
import { WorkspaceOverview } from '../../clubOperations/WorkspaceOverview';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { ChildDirectory } from '../api';
import type { SquadSpace, SquadSession, SquadOverview } from '../../squadCommunication/api';
import '../../../index.css';
import '../../../styles/product-identity.css';
import '../../../styles/app-motion.css';
import '../../../components/workspace/workspace-design-theme.css';

if (!import.meta.env.DEV || !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Local development fixture only');
const params=new URLSearchParams(location.search), scenario=params.get('case')||'family';
const dark=params.get('theme')!=='light', language=params.get('lang')==='ka'?'ka':'en';
applyDocumentTheme(dark?'dark':'light'); await i18n.changeLanguage(language);
setStoredAccessToken('synthetic-local-parent-preview');
const coach={id:31,username:'synthetic-parent',fullName:'Demo Parent',role:'PARENT',email:'parent@example.invalid',emailVerified:true,profileComplete:true,onboardingRequired:false,mustChangePassword:false,
    navigationCapabilities:{version:1,workspaces:[{id:'parent.hub',context:{type:'user',id:31,label:'Parent Hub'}},{id:'squad.workspace',context:{type:'squad',id:11,label:'Riverside Academy · Development U16'}},{id:'squad.workspace',context:{type:'squad',id:22,label:'Riverside Academy · Development U12'}}]}};
const directory:ChildDirectory={children:[['Ana Example',61,'2011-04-09'],['Saba Example',62,'2015-07-03'],['Doli Example',63,'2015-09-01']].map(([name,id,dob])=>({
    playerId:Number(id),identity:{playerId:Number(id),version:1,fullName:String(name),dateOfBirth:String(dob),gender:null,photoUrl:null,positions:[],dominantFoot:null,heightCm:null,weightKg:null,canEdit:true,minor:true},
    clubs:Number(id)===63?[]:[{clubId:1,clubName:'Riverside Academy · Demo',cardId:Number(id)+400,affiliationStatus:'ACTIVE',consentStatus:scenario==='consent'&&id===62?'PENDING':'CONFIRMED',squadNames:[Number(id)===61?'Development U16':'Development U12']}],cases:[],inquiries:[]}))};
const spaces:SquadSpace[]=[{id:11,club_id:1,academy_name:'Riverside Academy · Demo',name:'Development U16',category:'U16',can_manage:false,unread_count:0},{id:22,club_id:1,academy_name:'Riverside Academy · Demo',name:'Development U12',category:'U12',can_manage:false,unread_count:0}];
const overview=(space:SquadSpace):SquadOverview=>({...space,viewer_id:31,member_count:16,notify_chat:true,head_coach_id:21,can_assign_coach:false,available_coaches:[],coaches:[{user_id:21,full_name:'Demo Coach'}],players:[{id:space.id===11?61:62,name:space.id===11?'Ana':'Saba'}],threads:[]});
const sessions=(squadId:number):SquadSession[]=>scenario==='empty-schedule'?[]:Array.from({length:scenario==='long'?24:7},(_,i)=>{
    const start=new Date();start.setDate(start.getDate()+(scenario==='long'?2:Math.floor(i/2)+1));start.setHours(9+(i%5)*2,0,0,0);
    return {id:91+i,title:['First touch & passing','Match preparation','Meet the squad and equipment check','Travel to the training ground','Return and collection'][i%5]+' · Demo',starts_at:start.toISOString(),ends_at:new Date(start.getTime()+90*60000).toISOString(),location:'Dighomi Sports Park · Demo — Small-sided training pitch',status:'SCHEDULED',cancellation_reason:null,revision:3,response_revision:3,response_kind:'INTENT',response_requested:true,attendance:[{id:squadId===11?61:62,name:squadId===11?'Ana':'Saba',response:i===0?'RECONFIRMATION_REQUIRED':'GOING',previous_response:'GOING',response_status:i===0?'RECONFIRMATION_REQUIRED':'VALID',active:true,recorded_by:'GUARDIAN'}]};
});
const family={children:directory.children.map(c=>({childId:c.playerId,name:c.identity.fullName,birthYear:Number(c.identity.dateOfBirth?.slice(0,4)),registered:false,guardians:[{id:12,guardianId:31,name:'Demo Parent',provenance:'PARENT_CREATED',canRevoke:true,self:true}],clubs:c.clubs.map(club=>({id:501+c.playerId,clubId:club.clubId,name:club.clubName,status:club.affiliationStatus,consent:club.consentStatus})),codes:c.playerId===63?[{id:19,expiresAt:'2026-10-16T12:00:00Z'}]:[],history:[{action:'PARENT_PROFILE_CREATED',createdAt:'2026-10-08T12:00:00Z'}]})),invitations:[],consentRequests:[],ended:[]};
const inbox={items:scenario==='pending'?[{key:'consent:1',actionable:true,title:'Review Saba’s club consent',context:'Saba Example · Riverside Academy',destination:'/parent?player=62&tab=connections'}]:[],counts:{incoming:scenario==='pending'?1:0,actionable:scenario==='pending'?1:0,outgoing:0,history:0},unavailableSources:[],hasMore:false,total:scenario==='pending'?1:0};
const role={id:'coach',label:'Coach',modules:['HOME','ATTENDANCE'],squadIds:[11],clubWide:false,appointmentId:1,revision:1};
const roles:RolesWorkspace={leadership:false,actorId:31,catalog:[],views:[role],current:role,requestSquads:[],squads:[{id:11,name:'Development U16',player_count:16}],people:[],sessions:sessions(11).map(s=>({id:s.id,title:s.title,starts_at:s.starts_at,squad_id:11,squad_name:'Development U16'})),requests:[],invitations:[]};
function response(data:unknown,config:InternalAxiosRequestConfig){return {data:structuredClone(data),status:200,statusText:'Synthetic',headers:{},config};}
apiClient.defaults.adapter=async config=>{
    const path=config.url||'';
    if(config.method!=='get')throw new Error('This preview blocks writes. No request was sent.');
    if(path==='/users/me')return response(coach,config);
    if(path==='/joining/children'){if(scenario==='error')throw new Error('Synthetic connection failure');if(scenario==='loading')return new Promise<never>(()=>{});return response(scenario==='empty'?{children:[]}:directory,config);}
    if(path==='/family')return response(scenario==='empty'?{...family,children:[]}:family,config);
    if(path==='/squad-communication')return response(spaces,config);
    const squad=path.match(/^\/squad-communication\/(11|22)$/);
    if(squad)return response(overview(spaces.find(s=>s.id===Number(squad[1]))!),config);
    const session=path.match(/^\/squad-communication\/(11|22)\/sessions$/);
    if(session)return response(sessions(Number(session[1])),config);
    if(path==='/requests')return response(inbox,config);
    if(path.startsWith('/schedule/'))return response({events:[]},config);
    if(path==='/journeys/schedule'||path.startsWith('/match-arrangements/')||path.includes('/workspace-roles/work'))return response([],config);
    if(path.startsWith('/joining/players/'))return response(directory.children.find(c=>c.playerId===Number(path.split('/').pop()))?.identity,config);
    throw new Error('Synthetic preview does not implement '+path+'. No request was sent.');
};
export const designPreviewFixtures={coach,directory,spaces,overviews:spaces.map(overview),sessions:spaces.map(space=>({id:space.id,items:sessions(space.id)})),family,inbox};
const route=params.get('route')==='/workspaces'?'/workspaces':params.get('route')==='/reference'?'/reference':'/parent';
const fixtureQuery=(key:string,value:string)=>{const next=new URLSearchParams(params);next.set(key,value);return '?'+next;};
createRoot(document.getElementById('root')!).render(<AuthProvider><MemoryRouter initialEntries={[route+(params.get('player')?'?player='+params.get('player'):'')]}>
    <header className="local-preview-bar"><strong>Local design preview · synthetic data · writes blocked</strong><nav><Link to="/parent">Parent Hub</Link><Link to="/workspaces">My work</Link><Link to="/reference">Club workspace reference</Link><a href={fixtureQuery('theme',dark?'light':'dark')}>{dark?'Light':'Dark'}</a><a href={fixtureQuery('case','long')}>Crowded week</a><a href={fixtureQuery('case','family')}>Normal week</a></nav></header>
    <div className="product-app-shell"><main className="app-page-shell"><div className="app-page-frame app-page-frame--wide"><div className="workspace-design-scope">
    <Routes><Route path="/parent" element={<ParentHubPage/>}/><Route path="/workspaces" element={<WorkspacesPage/>}/><Route path="/reference" element={<WorkspaceOverview data={roles} boot={null} tabs={[]} shortcuts={{ids:[],toggle:()=>{},move:()=>{}}} onOpen={()=>{}} overviewProps={{overview:null,clubId:1,onTabChange:()=>{},canManageLeadership:false,canManageOperations:false,upcomingEvents:[],scheduleLoading:false,scheduleError:null,tryoutPendingCount:0,unreadInboxCount:0,onOpenSchedule:()=>{},onRetrySchedule:()=>{}}}/>}/><Route path="*" element={<div style={{padding:24}}><p>This destination is outside the isolated design preview.</p><Link to="/parent">Return to Parent Hub</Link></div>}/></Routes>
    </div></div></main></div>
</MemoryRouter></AuthProvider>);
