import { connectedWorkspaces } from './connectedWorkspaces';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, LayoutGrid } from 'lucide-react';
import { type NavigationCapabilities } from '../../context/navigationCapabilities';
import './workspace-access.css';

export function WorkspaceAccess({ caps, className = '', userId }: { caps?: NavigationCapabilities; className?: string; userId?: number }) {
  const links = connectedWorkspaces(caps);
  const [open, setOpen] = useState(false);
  const id = useId();
  const [last, setLast] = useState<string>(() => { try { return localStorage.getItem(`gk:workspace:${userId}`) ?? ''; } catch { return ''; } });
  const select = (path: string) => { setOpen(false); setLast(path); try { localStorage.setItem(`gk:workspace:${userId}`, path); } catch { /* Optional preference. */ } };
  if (!links.length) return null;
  const preferred = links.find(w => w.path === last);
  if (links.length === 1) return <Link to={links[0].path} className={className} onClick={() => select(links[0].path)}><LayoutGrid size={20} /><span>Workspace</span></Link>;
  const ordered = preferred ? [preferred, ...links.filter(w => w.path !== preferred.path)] : links;
  return <div className="workspace-access" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
    <button type="button" className={className} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><LayoutGrid size={20} /><span>Workspace</span><ChevronDown size={16} /></button>
    {open && <nav id={id} aria-label="Choose workspace" className="workspace-access-list">
      {ordered.map(w => <Link key={w.key} to={w.path} className="workspace-access-link" title={w.label} onClick={() => select(w.path)}><LayoutGrid size={15} aria-hidden="true" /><span><strong>{w.label}</strong><small>{w.path === preferred?.path ? 'Recently opened · ' : ''}{w.group}</small></span></Link>)}<Link className="workspace-access-link workspace-access-all" to="/workspaces" onClick={() => select('/workspaces')}>All my workspaces<ArrowUpRight size={14} aria-hidden="true" /></Link>
    </nav>}
  </div>;
}
