import { useEffect,useState } from 'react';
import { Link,Navigate,useParams,useSearchParams } from 'react-router-dom';
import { ArrowLeft,Clipboard,MessageCircle,Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractApiErrorMessage } from '../utils/apiError';
import * as api from '../features/squadCommunication/api';
import { SquadSpacesPanel } from '../features/squadCommunication/SquadSpacesPanel';
import '../features/squadCommunication/squad-communication.css';
import { SquadMessages as Messages } from '../features/squadCommunication/SquadMessages';
import { squadMessageUrl } from '../features/squadCommunication/routes';
import { SquadCoachIdentity } from '../features/squadCommunication/SquadCoachIdentity';
import { SquadSchedulePreview } from '../features/squadCommunication/SquadSchedulePreview';
import { FamilySchedule } from '../features/parents/FamilySchedule';
import { positivePlayerId } from '../features/parents/playerSelection';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { sessionNavigation } from '../features/squadCommunication/sessionLink';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';
import { isoDay } from '../design/calendar/calendarDates';
import { accessibleClubs } from '../components/layout/clubAccess';
import { hasNavigationCapability } from '../context/navigationCapabilities';

import {SquadNotificationToggle} from '../features/squadCommunication/SquadNotificationToggle';
import '../features/squadCommunication/squad-life.css';
import '../features/parents/family-workspace.css';

type Tab='announcements'|'chat'|'coach'|'sessions';
export function MySquadsPage(){const {user}=useAuth();if(accessibleClubs(user?.navigationCapabilities).some(club=>club.canOpenWorkspace))return <Navigate replace to="/my-squads"/>;const parent=hasNavigationCapability(user?.navigationCapabilities,'parent.hub');return <main className="squad-page"><Link className="squad-back" to={parent?"/parent":"/"}><ArrowLeft size={20}/>{parent?"Back to Parent Hub":"Back to home"}</Link><header className="squad-page-heading"><span className="squad-eyebrow">ACADEMY FOOTBALL</span><h1>My squads</h1><p>One place for your coach, your teammates and your family’s football.</p></header><SquadSpacesPanel/></main>;}
export function SquadCommunicationPage(){const {squadId}=useParams(),{sessionId}=useAuth();return squadId&&/^\d+$/.test(squadId)?<SquadRoom key={`${sessionId}:${squadId}`} id={Number(squadId)}/>:<main className="squad-page"><h1>Squad not found</h1><Link to="/squads">My squads</Link></main>;}
export function SquadRoom({id}:{id:number}) {
 const copy=useJourneyCopy();
 const loadErrorMessage=copy('We could not open this squad. Please try again.','გუნდის სივრცე ვერ გაიხსნა. სცადეთ ხელახლა.');
 const [params]=useSearchParams();
 const initial=params.get('tab');
 const tab:Tab=params.has('thread')?'coach':initial==='sessions'||initial==='chat'||initial==='coach'?initial:'announcements';
 const [space,setSpace]=useState<api.SquadOverview|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const requested=Number(params.get('thread'));
 const thread=space?.can_manage?(Number.isSafeInteger(requested)&&requested>0?requested:null):(space?.viewer_id??null);
 const refresh=()=>setRevision(n=>n+1);
 useEffect(()=>{let active=true;const abort=new AbortController();
  const load=()=>{if(document.hidden)return;void api.overview(id,abort.signal).then(s=>{if(active){setSpace(s);setError('');}}).catch(e=>{if(active){setSpace(null);setError(extractApiErrorMessage(e,loadErrorMessage));}});};
  load();const timer=setInterval(load,15000);return()=>{active=false;abort.abort();clearInterval(timer);};
 },[id,revision,loadErrorMessage]);
 if(error)return <main className="squad-page"><Link to="/squads">← {copy('Back to my squads','ჩემს გუნდებში დაბრუნება')}</Link><div role="alert" className="squad-empty"><h1>{copy('Squad space unavailable','გუნდის სივრცე მიუწვდომელია')}</h1><p>{error}</p><button onClick={refresh}>{copy('Try again','სცადეთ ხელახლა')}</button></div></main>;
 if(!space)return <main className="squad-page" role="status">{copy('Opening your squad…','გუნდის სივრცე იხსნება…')}</main>;
 if(tab==='chat'||tab==='coach')return <Navigate replace to={squadMessageUrl(id,tab==='coach',space.can_manage?thread:null)}/>;
 // Coaches run their squads from My squads (updates, calendar, players, coaches); this page stays the families' squad room.
 if(space.can_manage){const nav=sessionNavigation(params),next=new URLSearchParams({tab:tab==='sessions'?'calendar':'updates',squad:String(id)});if(nav.initialSessionId)next.set('session',`${id}:${nav.initialSessionId}`);if(nav.initialDate)next.set('date',isoDay(nav.initialDate));return <Navigate replace to={`/my-squads?${next}`}/>;}
 if(tab==='sessions')return <main className="squad-page"><FamilySchedule key={`${id}:${params.get('sessionId')}:${params.get('at')}`} squads={[space]} playerId={positivePlayerId(params.get('player'))} {...sessionNavigation(params)}/></main>;
 return <FamilyRoom space={space} onRefresh={refresh}/>;
}
function FamilyRoom({space,onRefresh}:{space:api.SquadOverview;onRefresh:()=>void}) {
 return <main className="squad-page family-room">
  <Link className="squad-back" to="/squads"><ArrowLeft size={16}/> Back to my squads</Link>
  <header className="squad-room-header family-room-header"><div><span className="squad-muted">{space.academy_name} · Academy club</span><h1>{space.name}</h1><p>{space.players.map(p=>p.name).join(' · ')}</p><SquadCoachIdentity space={space}/></div><div className="family-room-actions"><Link to={squadMessageUrl(space.id,true)}><MessageCircle size={16}/>Message coach</Link><Link to={squadMessageUrl(space.id)}>Squad chat</Link></div></header>
   <MatchHistoryLink squadId={space.id} clubId={space.club_id} className="squad-back" />
   <div className="family-room-layout"><div className="family-room-content"><Messages space={space} kind="ANNOUNCEMENT" thread={null} onSent={onRefresh}/></div>
    <aside className="family-room-aside"><SquadSchedulePreview key={space.id} squad={space}/><details className="squad-panel"><summary>Notifications & sharing</summary><SquadNotificationToggle id={space.id} enabled={space.notify_chat} onSaved={onRefresh}/><p className="squad-muted">Important coach updates still notify you.</p><ShareSquad space={space}/></details><Link to={`/clubs/${space.club_id}`}>Academy club information</Link></aside>
   </div>
 </main>;
}
function ShareSquad({space}:{space:api.SquadOverview}) {
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 const url=`${location.origin}/squads/${space.id}`;
 return <div className="squad-share"><h3>Keep your squad together</h3><a href={`https://wa.me/?text=${encodeURIComponent(`${space.name} · ${space.academy_name}\nCoach updates and squad conversations: ${url}`)}`} target="_blank" rel="noopener noreferrer"><Share2 size={16}/>Share squad on WhatsApp</a><button onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setCopied(true)).catch(()=>setError('Copy the link from your address bar.'));}}><Clipboard size={16}/>{copied?'Link copied':'Copy squad link'}</button><p className="squad-muted">Only linked families, squad players and assigned staff can open this space. Sharing opens WhatsApp; it does not connect or sync the group chats.</p>{error&&<p role="status">{error}</p>}</div>;
}
