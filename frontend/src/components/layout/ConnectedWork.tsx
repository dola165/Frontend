import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { connectedWorkspaces } from './connectedWorkspaces';
import './connected-work.css';
export { WorkspacesPage } from './WorkspacesPage';

/** The same connections are available from every professional, family and organization context. */
export function ConnectedWork({clubId}:{clubId?:number}) {
  const {user}=useAuth();
  const links=connectedWorkspaces(user?.navigationCapabilities).filter(w=>w.group==='Personal work'&&w.key.split(':')[0]!=='club.work');
  if(!links.length)return null;
  return <section className="connected-work" aria-label="Your personal workspaces"><header><h2>Your work across football</h2><Link to="/workspaces">All workspaces <ArrowRight size={15}/></Link></header><div className="connected-work-grid">{links.map(w=><article key={w.key}><h3><Link to={w.path}>{w.label}<ArrowRight size={16}/></Link></h3><p>{w.description}</p><div className="work-connection-links">{w.actions?.map(a=><Link key={a.path} to={a.path}>{a.label}</Link>)}</div></article>)}</div>{clubId&&<p className="connected-work-note">Your personal work remains available alongside your responsibilities at this club.</p>}</section>;
}

export function WorkspaceConnectionBar() {
  const {user}=useAuth(),location=useLocation();
  if(!user)return null;
  // Put the compact gateway on work surfaces, not on public browsing, onboarding or map canvases.
  if(!/^\/(parent(?:\/|$)|agent(?:\/|$)|referees\/me|organizations\/\d+\/workspace|stadiums\/\d+\/manage|tournaments\/\d+\/workspace|squads\/\d+|club-operations|my-club|my-organizations|match-exchange\/\d+)/.test(location.pathname))return null;
  const links=connectedWorkspaces(user.navigationCapabilities).filter(w=>['Clubs','Personal work'].includes(w.group)&&!location.pathname.startsWith(w.path.split('?')[0]));
  return <nav className="workspace-connection-bar" aria-label="Connected workspaces"><Link className="workspace-connection-gateway" to="/workspaces"><LayoutGrid size={16}/>All my workspaces</Link>{links.length>0&&<div className="workspace-connection-options"><span>Also available</span>{links.slice(0,4).map(w=><Link key={w.key} to={w.path}>{w.group==='Clubs'?<Building2 size={15}/>:<LayoutGrid size={15}/>}<span>{w.label}</span><ArrowRight size={14}/></Link>)}</div>}</nav>;
}
