import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { connectedWorkspaces } from './connectedWorkspaces';
import './connected-work.css';

/** The same connections are available from every professional, family and organization context. */
export function ConnectedWork({clubId}:{clubId?:number}) {
  const {user}=useAuth();
  const links=connectedWorkspaces(user?.navigationCapabilities).filter(w=>w.group==='Personal work'&&w.key.split(':')[0]!=='club.work');
  if(!links.length)return null;
  return <section className="connected-work" aria-label="Your personal workspaces"><header><h2>Your work across football</h2></header><div className="connected-work-grid">{links.map(w=><article key={w.key}><h3><Link to={w.path}>{w.label}<ArrowRight size={16}/></Link></h3><p>{w.description}</p><div className="work-connection-links">{w.actions?.map(a=><Link key={a.path} to={a.path}>{a.label}</Link>)}</div></article>)}</div>{clubId&&<p className="connected-work-note">Your personal work remains available alongside your responsibilities at this club.</p>}</section>;
}
