import { useEffect,useState } from 'react';
import { Link,Navigate,useParams,useSearchParams } from 'react-router-dom';
import { ArrowLeft,Bell,CalendarDays,Clipboard,LockKeyhole,MessageCircle,Megaphone,Share2,Users } from 'lucide-react';
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
import { CoachNextActions } from '../features/squadCommunication/CoachNextActions';
import { useJourneyCopy } from '../features/squadCommunication/journeyCopy';
import { sessionNavigation } from '../features/squadCommunication/sessionLink';
import { MatchHistoryLink } from '../features/matchHistory/MatchHistoryLink';

import {SquadNotificationToggle} from '../features/squadCommunication/SquadNotificationToggle';
import {SquadEnrollmentManager} from '../features/squadEnrollment/SquadEnrollment';
import { ExtensionSurface } from '../features/capabilities/ExtensionBoundary';
import '../features/squadCommunication/squad-life.css';
import '../features/parents/family-workspace.css';

type Tab='announcements'|'chat'|'coach'|'sessions';
const errorText=(e:unknown)=>extractApiErrorMessage(e,'This could not be saved. Please try again.');
export function MySquadsPage(){const {user}=useAuth();return <main className="squad-page"><Link className="squad-back" to={user?.role==="PARENT"?"/parent":"/"}><ArrowLeft size={20}/>{user?.role==="PARENT"?"Back to Parent Hub":"Back to home"}</Link><header className="squad-page-heading"><span className="squad-eyebrow">ACADEMY FOOTBALL</span><h1>My squads</h1><p>One place for your coach, your teammates and your family’s football.</p></header><SquadSpacesPanel/></main>;}
export function SquadCommunicationPage(){const {squadId}=useParams(),{sessionId}=useAuth();return squadId&&/^\d+$/.test(squadId)?<SquadRoom key={`${sessionId}:${squadId}`} id={Number(squadId)}/>:<main className="squad-page"><h1>Squad not found</h1><Link to="/squads">My squads</Link></main>;}
export function SquadRoom({id}:{id:number}) {
 const copy=useJourneyCopy();
 const loadErrorMessage=copy('We could not open this squad. Please try again.','გუნდის სივრცე ვერ გაიხსნა. სცადეთ ხელახლა.');
 const [params,setParams]=useSearchParams();
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
 if(tab==='sessions')return <main className="squad-page"><FamilySchedule key={`${id}:${params.get('sessionId')}:${params.get('at')}`} squads={[space]} playerId={positivePlayerId(params.get('player'))} {...sessionNavigation(params)}/></main>;
 if(!space.can_manage)return <FamilyRoom space={space} onRefresh={refresh}/>;
 const select=(value:Tab)=>setParams({tab:value});
 return <main className="squad-page coach-room">
  <Link className="squad-back" to="/squads"><ArrowLeft size={16}/> {copy('All my squads', 'ყველა ჩემი გუნდი')}</Link>
  <header className="squad-room-header coach-room-header"><div className="coach-room-heading"><span className="squad-eyebrow">{space.academy_name} · {copy('Coach workspace', 'მწვრთნელის სივრცე')}</span><div className="coach-room-title"><h1>{space.name}</h1><p><Users size={16}/>{space.member_count} {copy('connected people', 'დაკავშირებული ადამიანი')} <span>·</span> {space.players.length} {copy('players', 'მოთამაშე')} <span>·</span> {space.coaches.length} {copy('coaches', 'მწვრთნელი')}</p></div></div><Link className="coach-room-roster" to={`/clubs/${space.club_id}${space.can_manage?'/workspace?tab=squads':''}`}><Users size={16}/>{copy('Manage roster', 'შემადგენლობის მართვა')}</Link></header>
  <CoachNextActions space={space}/>
  <MatchHistoryLink squadId={space.id} clubId={space.club_id} className="squad-back" />
  <div className="squad-room-layout"><div className="squad-main"><nav className="squad-tabs" aria-label="Squad communication">{([['announcements','Coach updates',Megaphone],['chat','Squad chat',MessageCircle],['coach','Private messages',LockKeyhole],['sessions','Sessions',CalendarDays]] as const).map(([value,label,Icon])=><button key={value} aria-pressed={tab===value} onClick={()=>select(value)}><Icon size={17}/>{label}</button>)}</nav>
   <div id="coach-updates"/>
   <ExtensionSurface capability="squadEnrollment"><SquadEnrollmentManager key={`enrollment:${id}`} squad={id}/></ExtensionSurface>
   <Messages space={space} kind="ANNOUNCEMENT" thread={null} onSent={refresh}/>
  </div><aside className="squad-room-aside"><section className="squad-panel squad-team-card"><p className="squad-panel-kicker">{copy('Squad access', 'გუნდზე წვდომა')}</p><h3>{copy('Coaching team', 'სამწვრთნელო გუნდი')}</h3>{space.coaches.map(c=><div className="squad-coach" key={c.user_id}><span>{c.full_name.slice(0,1)}</span><div><strong>{c.full_name}</strong><small>{copy('Coach / academy staff', 'მწვრთნელი / აკადემიის თანამშრომელი')}</small></div></div>)}{space.can_assign_coach&&<label style={{marginTop:16}}>Assigned squad coach<select aria-label="Assigned squad coach" value={space.head_coach_id??''} onChange={async e=>{try{await api.assignCoach(id,e.target.value?Number(e.target.value):null);refresh();}catch(e){setError(errorText(e));}}}><option value="">Academy leadership only</option>{space.available_coaches.map(c=><option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}</select></label>}<p className="squad-muted">{copy('Private messages stay between each family and the coaching team.', 'პირადი შეტყობინებები თითოეულ ოჯახსა და სამწვრთნელო გუნდს შორის რჩება.')}</p><button onClick={()=>select('coach')}><LockKeyhole size={16}/> {copy('Family conversations', 'ოჯახებთან საუბრები')}</button></section>
   <section className="squad-panel squad-preferences-card"><p className="squad-panel-kicker">{copy('Preferences', 'პარამეტრები')}</p><h3><Bell size={16}/> {copy('Notifications', 'შეტყობინებები')}</h3><SquadNotificationToggle id={id} enabled={space.notify_chat} onSaved={refresh}/><p className="squad-muted">{copy('Coach announcements and session changes still notify you. Mobile push depends on your device settings.', 'მწვრთნელის განცხადებები და სესიის ცვლილებები კვლავ შეგატყობინებთ. მობილური შეტყობინებები მოწყობილობის პარამეტრებზეა დამოკიდებული.')}</p><details className="squad-share-disclosure"><summary>{copy('Share squad access', 'გუნდზე წვდომის გაზიარება')}</summary><ShareSquad space={space}/></details></section>
  </aside></div>
 </main>;
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
