import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, Pin, Search, Users } from 'lucide-react';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import type { RolesWorkspace } from './useWorkspaceRoles';
import { get, label, moduleNames, type Bootstrap, type OperationRecord } from './api';
import { operationTab } from './workspaceNavigation';
import { workspaceAreas, toolDescription } from './workspaceStructure';
import { extractApiErrorMessage } from '../../utils/apiError';
import './workspace-home.css';

export type OpenWorkspace = (tab:WorkspaceTab,context?:Record<string,string>)=>void;
export function WorkspaceHome({data,boot,tabs,shortcuts,onOpen,squad,onSquad,applications=0}:{data:RolesWorkspace;boot:Bootstrap|null;tabs:TabItem[];shortcuts:string[];onOpen:OpenWorkspace;squad:string;onSquad:(id:string)=>void;applications?:number}) {
  const [result,setResult]=useState<{key:string;rows:OperationRecord[];error:string}|null>(null),[mine,setMine]=useState(false),[revision,setRevision]=useState(0);
  const key=`${data.actorId}:${squad}:${mine}:${revision}`;
  useEffect(()=>{const c=new AbortController();if(!boot)return;
    const query=new URLSearchParams({module:'HOME',mine:String(mine)});if(squad)query.set('squad',squad);
    void get<OperationRecord[]>(`/clubs/${boot.clubId}/workspace-roles/work?${query}`,c.signal).then(rows=>{if(!c.signal.aborted)setResult({key,rows,error:''});}).catch(e=>{if(!c.signal.aborted)setResult({key,rows:[],error:extractApiErrorMessage(e,'Could not load your work.')});});return()=>c.abort();
  },[boot,key,mine,squad]);
  const rows=boot&&result?.key===key?result.rows:[],loading=Boolean(boot)&&result?.key!==key,error=result?.key===key?result.error:'';
  const approvals=data.leadership?data.requests.filter(r=>r.status==='PENDING'&&r.user_id!==data.actorId).length:0;
  const sessions=data.sessions.filter(s=>!squad||String(s.squad_id)===squad);
  const attendance=boot?.modules.find(m=>m.id==='ATTENDANCE');
  return <section className="work-home">
    <header className="work-heading"><div><h1>Home</h1><p>{boot?.clubName??'Your club'} · Work shared with you, across all your responsibilities.</p></div>{data.squads.length>0&&<label className="work-scope">Squad<select aria-label="Home squad" value={squad} onChange={e=>onSquad(e.target.value)}><option value="">All my squads</option>{data.squads.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}</header>
    {(data.invitations.length>0||data.requests.some(r=>r.user_id===data.actorId&&r.status==='PENDING'))&&<button className="work-notice" onClick={()=>onOpen('my-role')}>Your staff roles · {data.invitations.length?'An invitation needs your response':'Your requested change is awaiting review'}<ArrowRight size={16}/></button>}
    {boot&&(boot.canReadMatches||boot.modules.some(m=>m.id==='TRAVEL'))&&<Link className="work-notice" to={`/map?plans=staff&club=${boot.clubId}${squad?`&squad=${squad}`:''}`}>Journey planning · Connect places, the itinerary, families and travel <ArrowRight size={16}/></Link>}
    <div className="work-home-grid"><div>
      <section className="work-panel"><header><h2>Needs attention</h2>{boot&&<button onClick={()=>onOpen('actions',squad?{squad}:{})}>View all <ArrowRight size={14}/></button>}</header>
        {boot&&<div className="work-list-controls"><label><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/>Assigned to me</label><span>Upcoming deadlines and open decisions</span></div>}
        {!mine&&!squad&&approvals>0&&<button className="work-row" onClick={()=>onOpen('role-requests')}><Users size={18}/><span><strong>{approvals} staff role {approvals===1?'request':'requests'}</strong><small>Review the person, responsibilities and squad before approving.</small></span><ArrowRight size={16}/></button>}
        {!mine&&!squad&&applications>0&&<button className="work-row" onClick={()=>onOpen('applications')}><Users size={18}/><span><strong>{applications} club {applications===1?'application':'applications'}</strong><small>Review players waiting to join.</small></span><ArrowRight size={16}/></button>}
        {loading?<p className="work-empty" role="status">Loading your work…</p>:error?<div className="work-empty" role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>Try again</button></div>:rows.slice(0,6).map(r=><button className="work-row" key={r.id} onClick={()=>onOpen(operationTab(r.module),{record:String(r.id),...(r.squad_id?{squad:String(r.squad_id)}:{})})}><span className={`work-status-dot ${r.expired?'is-overdue':''}`} aria-hidden/><span><strong>{r.title}</strong><small>{moduleNames[r.module]} · {r.squad_id?(boot?.squads.find(s=>s.id===r.squad_id)?.name??`Squad #${r.squad_id}`):'Club-wide'}</small></span><span className="work-row-end">{label(r.status)}<small>{r.attentionDate??r.due_on??''}</small></span></button>)}
        {!loading&&!error&&!rows.length&&<div className="work-empty"><CheckCircle2 size={22}/><strong>{mine?'No open work assigned to you':'No upcoming record deadlines'}</strong><p>{mine?'Clear the filter to see shared club responsibilities.':'Open a tool to continue your work or add a record.'}</p></div>}
      </section>
      {sessions.length>0&&<section className="work-panel"><header><h2>Upcoming training</h2><span>Next 14 days</span></header>{sessions.slice(0,6).map(s=><div className="work-row" key={s.id}><time className="work-date" dateTime={s.starts_at}><b>{new Date(s.starts_at).getDate()}</b>{new Date(s.starts_at).toLocaleDateString(undefined,{month:'short'})}</time><span><strong>{s.title}</strong><small>{s.squad_name} · {new Date(s.starts_at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small></span>{attendance&&(attendance.globalRead||attendance.readSquads?.includes(s.squad_id))?<button className="work-row-action" onClick={()=>onOpen('attendance',{squad:String(s.squad_id),session:String(s.id)})}>Attendance <ArrowRight size={14}/></button>:<CalendarDays size={18}/>}</div>)}</section>}
    </div><aside className="work-home-aside"><section className="work-panel"><header><h2>Your shortcuts</h2><button onClick={()=>onOpen('tools')}>Edit</button></header>{shortcuts.map(id=>tabs.find(t=>t.id===id)).filter((t):t is TabItem=>Boolean(t)).map(t=><button className="work-shortcut" key={t.id} onClick={()=>onOpen(t.id)}><t.icon size={17}/>{t.label}<ArrowRight size={14}/></button>)}{!shortcuts.length&&<p className="work-empty">Pin the tools you use most.</p>}<button className="work-panel-footer" onClick={()=>onOpen('tools')}>Explore all tools <ArrowRight size={14}/></button></section>
    {data.squads.length>0&&<section className="work-panel"><header><h2>Your squads</h2><span>{data.squads.length}</span></header>{data.squads.slice(0,5).map(s=><button className="work-shortcut" key={s.id} onClick={()=>onOpen('my-squads',{squad:String(s.id)})}><Users size={16}/><span>{s.name}<small>{s.player_count} {s.player_count===1?'player':'players'}</small></span><ArrowRight size={14}/></button>)}<button className="work-panel-footer" onClick={()=>onOpen('my-squads')}>Open squad workspace <ArrowRight size={14}/></button></section>}
    <p className="work-access-note">Your roles determine access. <button onClick={()=>onOpen('my-role')}>View or request responsibilities</button></p></aside></div>
  </section>;
}

export function WorkspaceTools({tabs,shortcuts,onToggle,onOpen,showHidden,onShowHidden,hasHidden}:{tabs:TabItem[];shortcuts:string[];onToggle:(tab:WorkspaceTab)=>void;onOpen:OpenWorkspace;showHidden:boolean;onShowHidden:(v:boolean)=>void;hasHidden:boolean}) {
  const [query,setQuery]=useState('');
  const groups=workspaceAreas.map(a=>({...a,tools:a.tabs.map(id=>tabs.find(t=>t.id===id)).filter((t):t is TabItem=>Boolean(t)).filter(t=>`${t.label} ${toolDescription(t)} ${a.label}`.toLowerCase().includes(query.toLowerCase()))})).filter(a=>a.tools.length);
  return <section className="work-tools"><header className="work-heading"><div><h1>All tools</h1><p>Everything available to you. Pin up to six tools for everyday use.</p></div></header><div className="work-tool-search"><label><Search size={18}/><input aria-label="Find a workspace tool" placeholder="Find a tool — travel, qualifications, equipment…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{hasHidden&&<label><input type="checkbox" checked={showHidden} onChange={e=>onShowHidden(e.target.checked)}/>Include disabled tools and history</label>}</div>{groups.length?groups.map(a=><section key={a.id} data-work-area={a.id} className="work-tool-group"><header><h2>{a.label}</h2><p>{a.description}</p></header><div>{a.tools.map(t=><div className="work-tool" key={t.id}><t.icon size={19}/><button onClick={()=>onOpen(t.id)}><strong>{t.label}</strong><span>{toolDescription(t)}</span></button><button className="work-pin" aria-pressed={shortcuts.includes(t.id)} aria-label={`${shortcuts.includes(t.id)?'Unpin':'Pin'} ${t.label}`} disabled={!shortcuts.includes(t.id)&&shortcuts.length>=6} onClick={()=>onToggle(t.id)}><Pin size={16}/></button></div>)}</div></section>):<p className="work-empty">No available tools match “{query}”. Try another name.</p>}</section>;
}
