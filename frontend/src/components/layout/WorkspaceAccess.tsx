import { connectedWorkspaces, type ConnectedWorkspace } from './connectedWorkspaces';
import { useId, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronsUpDown } from 'lucide-react';
import { type NavigationCapabilities } from '../../context/navigationCapabilities';
import { useJourneyCopy } from '../../features/squadCommunication/journeyCopy';
import { Crest } from '../../features/world/Crest';
import { fetchClubProfile } from '../../features/world/api';
import { useWorldData } from '../../features/world/useWorldData';
import '../../design/design.css';
import './workspace-access.css';

const clubIdOf = (workspace: ConnectedWorkspace) => workspace.key.startsWith('club:') ? Number(workspace.key.slice(5)) : null;

function WorkspaceCrest({ workspace, size }: { workspace: ConnectedWorkspace; size: number }) {
  const clubId = clubIdOf(workspace);
  const club = useWorldData(clubId ? `club:${clubId}` : null, signal => fetchClubProfile(clubId!, signal)).data;
  // The crest is a design-system part: it takes its look from the `.gk` scope.
  return <span className="gk workspace-access__crest"><Crest src={club?.logoUrl} name={workspace.label} size={size} /></span>;
}

/**
 * The person's workspace as one row: crest and name, "Workspace" underneath, the whole row opens it. Only someone
 * with more than one workspace gets the small switcher beside it; the one opened last leads next time.
 */
export function WorkspaceAccess({ caps, userId }: { caps?: NavigationCapabilities; userId?: number }) {
  const copy = useJourneyCopy();
  const links = connectedWorkspaces(caps);
  const [open, setOpen] = useState(false);
  const id = useId();
  const [last, setLast] = useState<string>(() => { try { return localStorage.getItem(`gk:workspace:${userId}`) ?? ''; } catch { return ''; } });
  const select = (path: string) => { setOpen(false); setLast(path); try { localStorage.setItem(`gk:workspace:${userId}`, path); } catch { /* Optional preference. */ } };
  if (!links.length) return null;
  const current = links.find(w => w.path === last) ?? links[0];
  const others = links.filter(w => w.path !== current.path);
  const subtitle = (w: ConnectedWorkspace) => clubIdOf(w) !== null && !w.path.endsWith('/workspace') ? copy('Club page', 'კლუბის გვერდი') : copy('Workspace', 'სამუშაო სივრცე');
  const close = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === 'Escape' && open) { setOpen(false); event.currentTarget.querySelector<HTMLButtonElement>('.workspace-access__switch')?.focus(); } };
  const leave = (event: FocusEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); };
  return <div className="workspace-access" onKeyDown={close} onBlur={leave}>
    <div className="workspace-access__row">
      <Link to={current.path} className="workspace-access__main" title={current.label} onClick={() => select(current.path)}>
        <WorkspaceCrest workspace={current} size={36} />
        <span className="workspace-access__text"><strong>{current.label}</strong><small>{subtitle(current)}</small></span>
      </Link>
      {others.length > 0 && <button type="button" className="workspace-access__switch" aria-expanded={open} aria-controls={id} aria-label={copy('Switch workspace', 'სამუშაო სივრცის შეცვლა')} onClick={() => setOpen(!open)}><ChevronsUpDown size={16} aria-hidden="true" /></button>}
    </div>
    {open && <nav id={id} aria-label={copy('Switch workspace', 'სამუშაო სივრცის შეცვლა')} className="workspace-access-list">
      {others.map(w => <Link key={w.key} to={w.path} className="workspace-access-link" title={w.label} onClick={() => select(w.path)}>
        <WorkspaceCrest workspace={w} size={28} /><span><strong>{w.label}</strong><small>{subtitle(w)}</small></span>
      </Link>)}
    </nav>}
  </div>;
}
