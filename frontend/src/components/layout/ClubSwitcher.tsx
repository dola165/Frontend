import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronDown, Shield, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { accessibleClubs, type ClubAccess } from './clubAccess';
import './club-switcher.css';
import { ConnectedWork } from './ConnectedWork';

export function ClubSwitcher({ enabled = true }: { enabled?: boolean }) {
  const { user, sessionId } = useAuth();
  const clubs = accessibleClubs(user?.navigationCapabilities);
  if (!enabled || clubs.length < 2) return null;
  return <ClubChooser key={`${sessionId}:${clubs.map(c => `${c.id}:${c.canOpenWorkspace}`).join(',')}`} clubs={clubs} />;
}
function ClubChooser({ clubs }: { clubs: ClubAccess[] }) {
  const { t } = useTranslation();
  const location = useLocation(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === location.key;
  const close = (focus = false) => { setOpenedAt(null); if (focus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a')?.focus();
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpenedAt(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenedAt(null); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <><button type="button" ref={trigger} className="club-switch-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? "my-club-switcher" : undefined} onClick={() => setOpenedAt(open ? null : location.key)}>{t('experience.clubs.switch', 'Switch club')}<ChevronDown size={13} /></button>
    {open && createPortal(<div ref={panel} id="my-club-switcher" className="club-switch-panel" role="dialog" aria-label={t('experience.clubs.choose', 'Choose your club')} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) close(); }}>
      <header><strong>{t('experience.clubs.title', 'My clubs')}</strong><button type="button" aria-label={t('experience.clubs.close', 'Close club switcher')} onClick={() => close(true)}><X size={18} /></button></header>
      <nav aria-label={t('experience.clubs.navigation', 'Your clubs')}>{clubs.map(club => {
        const current = location.pathname.startsWith(`/clubs/${club.id}/`) || location.pathname === `/clubs/${club.id}`;
        return <section key={club.id} aria-label={club.name} className={current ? 'club-switch-current' : ''}><strong><Shield size={18} />{club.name}</strong>{current && <p className="club-switch-context">{t('experience.clubs.current', 'Current club')}</p>}<div><Link to={`/clubs/${club.id}`} aria-current={location.pathname === `/clubs/${club.id}` ? 'page' : undefined} onClick={() => close()}>{t('experience.clubs.profile', 'View profile')}</Link>{club.canOpenWorkspace && <Link to={`/clubs/${club.id}/workspace`} aria-current={location.pathname === `/clubs/${club.id}/workspace` ? 'page' : undefined} onClick={() => close()}>{t('experience.clubs.workspace', 'Open workspace')}</Link>}</div></section>;
      })}</nav>
      <Link className="club-switch-all" to="/my-club" onClick={() => close()}>{t('experience.clubs.all', 'View all my clubs →')}</Link>
    </div>, document.body)}
  </>;
}
export function ClubAccessEntry({ children }: { children: ReactNode }) {
  const { user, sessionId } = useAuth();
  const clubs = accessibleClubs(user?.navigationCapabilities);
  if (clubs.length === 1) return <Navigate to={`/clubs/${clubs[0].id}`} replace />;
  return clubs.length > 1 ? <ClubGallery key={sessionId} clubs={clubs} /> : children;
}
function ClubGallery({ clubs }: { clubs: ClubAccess[] }) {
  const { t } = useTranslation();
  return <main className="my-club-gallery"><header><h1>{t('experience.clubs.title', 'My clubs')}</h1><p>{t('experience.clubs.description', 'Choose a club to view its profile or open the workspace for your responsibilities.')}</p></header><ConnectedWork /><div>{clubs.map(club => <article key={club.id}><div className="my-club-card-cover"><Shield size={42} /></div><section><h2>{club.name}</h2><p>{club.relationships.join(' · ')}</p><div><Link to={`/clubs/${club.id}`}>{t('experience.clubs.profile', 'View profile')}</Link>{club.canOpenWorkspace && <Link to={`/clubs/${club.id}/workspace`}>{t('experience.clubs.workspace', 'Open workspace')}</Link>}</div></section></article>)}</div></main>;
}
