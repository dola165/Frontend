import { connectedWorkspaces } from './connectedWorkspaces';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { type NavigationCapabilities } from '../../context/navigationCapabilities';

export function WorkspaceAccess({ caps, className = '', userId }: { caps?: NavigationCapabilities; className?: string; userId?: number }) {
  const links = connectedWorkspaces(caps);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string>(() => { try { return localStorage.getItem(`gk:workspace:${userId}`) ?? ''; } catch { return ''; } });
  const select = (path: string) => { setOpen(false); setLast(path); try { localStorage.setItem(`gk:workspace:${userId}`, path); } catch { /* Optional preference. */ } };
  if (!links.length) return null;
  const preferred = links.find(w => w.path === last);
  if (links.length === 1) return <Link to={links[0].path} className={className} onClick={() => select(links[0].path)}><LayoutGrid size={20} /><span>Workspace</span></Link>;
  return <div className="workspace-access">
    <button type="button" className={className} aria-expanded={open} onClick={() => setOpen(!open)}><LayoutGrid size={20} /><span>Workspace</span><ChevronDown size={16} /></button>
    {open && <nav aria-label="Choose workspace" className="workspace-access-list">
      {preferred && <Link to={preferred.path} onClick={() => select(preferred.path)}>Continue: {preferred.label}</Link>}
      {links.map(w => <Link key={w.key} to={w.path} onClick={() => select(w.path)}>{w.label}</Link>)}<Link to="/workspaces" onClick={() => select('/workspaces')}>All my workspaces</Link>
    </nav>}
  </div>;
}
