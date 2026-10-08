import { Link } from 'react-router-dom';
import { ConnectedWork } from '../../components/layout/ConnectedWork';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, CalendarDays, Check, ChevronRight, Plus, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { OverviewTab } from '../../components/workspace/tabs/OverviewTab';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import type { TabItem, WorkspaceTab } from '../../components/workspace/types';
import type { RolesWorkspace } from './useWorkspaceRoles';
import { get, label, moduleNames, type Bootstrap, type OperationRecord } from './api';
import { operationTab } from './workspaceNavigation';
import { toolDescription } from './workspaceStructure';
import type { OpenWorkspace } from './WorkspaceHome';
import { extractApiErrorMessage } from '../../utils/apiError';
import './workspace-polish.css';

interface Props {
  overviewProps: ComponentProps<typeof OverviewTab>;
  data: RolesWorkspace;
  boot: Bootstrap | null;
  tabs: TabItem[];
  shortcuts: { ids:string[]; toggle:(tab:WorkspaceTab)=>void; move:(id:string,direction:-1|1)=>void };
  onOpen: OpenWorkspace;
}

export function WorkspaceOverview({overviewProps,data,boot,tabs,shortcuts,onOpen}:Props) {
  const preference=`gk-club-overview:${overviewProps.clubId}:${data.actorId}`;
  const [savedFocus,setSavedFocus]=useState(()=>{try{return localStorage.getItem(preference)??'all';}catch{return 'all';}});
  const [editing,setEditing]=useState(false);
  const views=data.views.filter(v=>!['all','member','club'].includes(v.id));
  const focus=savedFocus==='all'||views.some(v=>`view:${v.id}`===savedFocus)||data.squads.some(s=>`squad:${s.id}`===savedFocus)?savedFocus:'all';
  const focusedView=views.find(v=>`view:${v.id}`===focus);
  const squads=data.squads.filter(s=>focus==='all'||focusedView?.squadIds.includes(s.id)||focus===`squad:${s.id}`);
  const sessions=data.sessions.filter(s=>squads.some(team=>team.id===s.squad_id));
  const trainingAccess=data.current.modules.some(m=>['ATTENDANCE','DEVELOPMENT','READINESS','TRAVEL','GUARDIANS'].includes(m));
  const peopleAccess=data.current.modules.some(m=>!['FACILITIES','READINESS','MATCHES','SPECIALISTS','HOME','SETTINGS'].includes(m));
  const clubView=focus==='all'&&overviewProps.overview!==null;
  const chooseFocus=(value:string)=>{setSavedFocus(value);try{localStorage.setItem(preference,value);}catch{/* Optional presentation preference. */}};
  const pending=data.requests.filter(r=>r.status==='PENDING'&&r.user_id!==data.actorId);
  const ownPending=data.requests.some(r=>r.status==='PENDING'&&r.user_id===data.actorId);
  const roleNames=data.views.filter(v=>!['all','member'].includes(v.id)).map(v=>v.label);
  const controls=<div className="wo-personal">
    <div className="wo-responsibilities"><span className="wo-personal-icon"><ShieldCheck size={19}/></span><div><span className="wo-caption">Your responsibilities</span><strong>{roleNames.join(' · ')||'Club member'}</strong><button type="button" onClick={()=>onOpen('my-role')}>{ownPending?'View pending role request':data.invitations.length?'Review role invitation':'Manage responsibilities'}<ChevronRight size={13}/></button></div></div>
    <label className="wo-focus"><span className="wo-caption">Overview focus</span><select aria-label="Overview focus" value={focus} onChange={e=>chooseFocus(e.target.value)}><option value="all">{overviewProps.overview?'Whole club':'All my work'}</option>{views.length>0&&<optgroup label="My responsibilities">{views.map(v=><option key={v.id} value={`view:${v.id}`}>{v.label}</option>)}</optgroup>}{data.squads.length>0&&<optgroup label="My squads">{data.squads.map(s=><option key={s.id} value={`squad:${s.id}`}>{s.name}</option>)}</optgroup>}</select></label>
  </div>;
  const quickAccess=<section className="wo-shortcuts" aria-label="Personal shortcuts"><header><div><h2>Your shortcuts</h2><span>{shortcuts.ids.length?'Chosen by you':'Keep your everyday tools close.'}</span></div><button type="button" className="sd-button" onClick={()=>setEditing(true)}><Settings2 size={14}/>{shortcuts.ids.length?'Edit shortcuts':'Choose shortcuts'}</button></header>{shortcuts.ids.length>0&&<div className="wo-shortcut-links">{shortcuts.ids.map(id=>tabs.find(t=>t.id===id)).filter((t):t is TabItem=>Boolean(t)).map(t=><button type="button" key={t.id} onClick={()=>onOpen(t.id)}><t.icon size={16}/>{t.label}<ArrowRight size={14}/></button>)}</div>}</section>;
  const attention=<>
    {data.invitations.length>0&&<button type="button" className="wo-attention-link" onClick={()=>onOpen('my-role')}>You have {data.invitations.length} staff role invitation{data.invitations.length===1?'':'s'}<ArrowRight size={15}/></button>}
    {data.leadership&&pending.length>0&&<button type="button" className="wo-attention-link" onClick={()=>onOpen('role-requests')}>{pending.length} staff role request{pending.length===1?'':'s'} to review<ArrowRight size={15}/></button>}
    {boot&&<OverviewWork club={boot.clubId} squads={focus==='all'?null:squads.map(s=>s.id)} onOpen={onOpen}/>}
  </>;
  const squadList=<section className="wo-squads"><header><h2>{focus==='all'?'Your squads':'Squads in this view'}</h2><button type="button" onClick={()=>onOpen('squads')}>View squads<ArrowRight size={14}/></button></header><div>{squads.map(s=><button type="button" key={s.id} onClick={()=>onOpen('squads',{squad:String(s.id)})}><span className="wo-squad-symbol"><Users size={17}/></span><span><strong>{s.name}</strong><small>{s.player_count} players</small></span><ChevronRight size={15}/></button>)}</div>{!squads.length&&<p className="wo-quiet">Squads assigned to you will appear here.</p>}</section>;
  const personalSchedule=<section className="sd-panel wo-training"><header className="club-overview-panel-heading"><div><span className="sd-eyebrow">Next 14 days</span><h2>Upcoming training</h2></div><CalendarDays size={20}/></header>{sessions.slice(0,6).map(s=><div className="wo-session" key={s.id}><time dateTime={s.starts_at}><strong>{new Date(s.starts_at).getDate()}</strong>{new Date(s.starts_at).toLocaleDateString(undefined,{month:'short'})}</time><span><strong>{s.title}</strong><small>{s.squad_name} · {new Date(s.starts_at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small></span><button type="button" onClick={()=>onOpen('squads',{squad:String(s.squad_id),view:'training',session:String(s.id)})}>Open session<ArrowRight size={14}/></button></div>)}{!sessions.length&&<p className="wo-quiet">No training sessions in the next 14 days.</p>}<button type="button" className="club-overview-panel-link" onClick={overviewProps.onOpenSchedule}>Full calendar<ArrowRight size={14}/></button></section>;
  const scopedStats=<div className="wo-scoped-stats"><span><strong>{squads.length}</strong> squads</span><span><strong>{new Set(data.people.filter(p=>squads.some(s=>s.id===p.squad_id)).map(p=>p.id)).size}</strong> players</span><span><strong>{sessions.length}</strong> upcoming sessions</span></div>;
  return <>
    <OverviewTab {...overviewProps} staffCount={boot?.leadership ? boot.staff.length : undefined} onOpenStaff={boot?.leadership ? ()=>onOpen('staff-duties') : undefined} canManageOperations={clubView&&overviewProps.canManageOperations} beforeContent={<>{controls}<ConnectedWork clubId={overviewProps.clubId}/></>} description={clubView?undefined:'Your approved club responsibilities, upcoming work and personal workspaces.'} statsContent={clubView?undefined:peopleAccess?scopedStats:<></>} scheduleContent={clubView?undefined:trainingAccess?personalSchedule:<section className="sd-panel work-connections-panel"><h2>Your club work</h2><p>Use the tools shared with you. Match assignments and personal commitments stay available in your own workspace.</p><div className="work-connection-links">{tabs.filter(t=>!['overview','my-day','tools','my-squads','squads','my-role','actions'].includes(t.id)).slice(0,6).map(t=><button type="button" className="sd-button" key={t.id} onClick={()=>onOpen(t.id)}><t.icon size={16}/>{t.label}</button>)}<Link to="/requests">Review my requests →</Link></div></section>} attentionContent={attention} quickActionsContent={<>{quickAccess}{data.squads.length>0&&squadList}</>}/>
    {editing&&<WorkspaceShortcutEditor tabs={tabs} shortcuts={shortcuts} onClose={()=>setEditing(false)}/>}
  </>;
}

function OverviewWork({club,squads,onOpen}:{club:number;squads:number[]|null;onOpen:OpenWorkspace}) {
  const [response,setResult]=useState<{key:string;rows:OperationRecord[];error:string}|null>(null);
  const [revision,setRevision]=useState(0);
  const scope=squads===null?'all':squads.join(',');
  const key=`${club}:${scope}:${revision}`,result=response?.key===key?response:null;
  useEffect(()=>{const c=new AbortController();void (async()=>{
    const ids=scope==='all'?[null]:scope.split(',').filter(Boolean);
    const lists=await Promise.all(ids.map(s=>get<OperationRecord[]>(`/clubs/${club}/workspace-roles/work?module=HOME${s?`&squad=${s}`:''}`,c.signal)));
    if(!c.signal.aborted)setResult({key,rows:lists.flat().sort((a,b)=>(a.attentionDate??a.due_on??'9999').localeCompare(b.attentionDate??b.due_on??'9999')).slice(0,4),error:''});
  })().catch(e=>{if(!c.signal.aborted)setResult({key,rows:[],error:extractApiErrorMessage(e,'Could not load outstanding work.')});});return()=>c.abort();},[club,scope,key]);
  if(!result)return <p className="wo-quiet" role="status">Checking outstanding work…</p>;
  if(result.error)return <p className="wo-quiet" role="alert">{result.error} <button type="button" onClick={()=>setRevision(v=>v+1)}>Retry</button></p>;
  if(!result.rows.length)return <button type="button" className="wo-attention-link wo-subtle" onClick={()=>onOpen('actions')}><Check size={15}/>No upcoming operations deadlines<ChevronRight size={14}/></button>;
  return <section className="sd-panel wo-attention"><header className="club-overview-panel-heading"><h2>Outstanding work</h2><button type="button" onClick={()=>onOpen('actions')}>View all<ArrowRight size={13}/></button></header>{result.rows.map(r=><button type="button" key={r.id} onClick={()=>onOpen(operationTab(r.module),{record:String(r.id),...(r.squad_id?{squad:String(r.squad_id)}:{})})}><span><strong>{r.title}</strong><small>{moduleNames[r.module]} · {label(r.status)}</small></span><ChevronRight size={15}/></button>)}</section>;
}

function WorkspaceShortcutEditor({tabs,shortcuts,onClose}:{tabs:TabItem[];shortcuts:Props['shortcuts'];onClose:()=>void}) {
  const ref=useRef<HTMLDivElement>(null),closeRef=useRef<HTMLButtonElement>(null);
  const [query,setQuery]=useState('');
  useDialogFocus(true,ref,onClose,closeRef);
  const options=tabs.filter(t=>!['overview','my-day','tools','my-squads'].includes(t.id));
  return <div className="wo-dialog-backdrop"><div className="squad-design wo-shortcut-editor" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" ref={ref}><header><div><span className="sd-eyebrow">Make it yours</span><h2 id="shortcuts-title">Your shortcuts</h2><p>Choose up to six tools and arrange them in your order.</p></div><button type="button" className="sd-icon-button" ref={closeRef} onClick={onClose} aria-label="Close shortcuts"><X size={20}/></button></header>
    {shortcuts.ids.length>0&&<ol className="wo-pin-order">{shortcuts.ids.map((id,index)=>{const tab=options.find(t=>t.id===id);return tab&&<li key={id}><tab.icon size={16}/><span>{tab.label}</span><button type="button" disabled={index===0} onClick={()=>shortcuts.move(id,-1)} aria-label={`Move ${tab.label} up`}><ArrowUp size={14}/></button><button type="button" disabled={index===shortcuts.ids.length-1} onClick={()=>shortcuts.move(id,1)} aria-label={`Move ${tab.label} down`}><ArrowDown size={14}/></button><button type="button" onClick={()=>shortcuts.toggle(tab.id)} aria-label={`Remove ${tab.label} shortcut`}><X size={14}/></button></li>;})}</ol>}
    <label className="wo-search"><Search size={17}/><input autoComplete="off" aria-label="Find a shortcut" placeholder="Search tools…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="wo-shortcut-options">{options.filter(t=>`${t.label} ${toolDescription(t)}`.toLowerCase().includes(query.toLowerCase())).map(t=><button type="button" key={t.id} aria-pressed={shortcuts.ids.includes(t.id)} disabled={!shortcuts.ids.includes(t.id)&&shortcuts.ids.length>=6} onClick={()=>shortcuts.toggle(t.id)}><t.icon size={17}/><span><strong>{t.label}</strong><small>{toolDescription(t)}</small></span>{shortcuts.ids.includes(t.id)?<Check size={17}/>:<Plus size={17}/>}</button>)}</div><footer><span>Saved for this account and club on this browser.</span><button type="button" className="sd-primary" onClick={onClose}>Done</button></footer></div></div>;
}
