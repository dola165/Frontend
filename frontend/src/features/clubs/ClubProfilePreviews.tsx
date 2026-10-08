import { useCallback, useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, type SetURLSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import type { ClubProfile } from '../../pages/ClubProfilePage';
import { clubPreviewTarget, type ClubPreviewTarget } from './clubProfilePreviewRoutes';
import { ClubPreviewActiveContext, ClubPreviewQueryContext } from './clubProfilePreviewContext';
import { ClubPreviewContent } from './ClubPreviewContent';
import './club-profile-previews.css';
import { useClubPanelMotion } from './useClubPanelMotion';

interface Entry { key: number; target: ClubPreviewTarget; trigger: HTMLElement | null }

export function ClubProfilePreviews({ club, children }: { club: ClubProfile; children: ReactNode }) {
  const location = useLocation();
  const [journey, setJourney] = useState<{ locationKey: string; entries: Entry[] }>({ locationKey: location.key, entries: [] });
  const nextKey = useRef(0);
  const scope = useRef<HTMLDivElement>(null);
  const pendingSection = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!pendingSection.current) return;
    const tab = pendingSection.current;
    pendingSection.current = null;
    const frame = requestAnimationFrame(() => {
      const section = scope.current?.querySelector<HTMLElement>(`[data-club-section="${tab}"]:not([hidden])`);
      if (!section) return;
      section.focus({preventScroll:true});
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-height')) || 100;
      window.scrollTo({top:Math.max(0, window.scrollY + section.getBoundingClientRect().top - header - 12), behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key]);
  const entries = journey.locationKey === location.key ? journey.entries : [];
  const close = useCallback(() => setJourney(current => ({ ...current, entries: [] })), []);
  const capture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    // A shorter section must not clamp the document scroll before its data arrives.
    if (scope.current) scope.current.style.minHeight = `${Math.max(0, window.innerHeight - scope.current.getBoundingClientRect().top)}px`;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const destination = new URL(anchor.href, window.location.href);
    const tab = destination.searchParams.get('tab');
    if (destination.origin === window.location.origin && destination.pathname === `/clubs/${club.id}` && tab && (['teams','posts'].includes(tab) || anchor.closest('[data-club-full-page]'))) pendingSection.current = tab;
    if (anchor.closest('[data-club-full-page]')) return;
    const target = clubPreviewTarget(anchor.href, window.location.href);
    if (!target) return;
    // Choosing training is the central reading task; supporting details still use the drawer.
    if (target.kind === 'club' && target.id === club.id && ['teams', 'posts'].includes(new URL(target.path, window.location.origin).searchParams.get('tab') || '')) return;
    event.preventDefault();
    event.stopPropagation();
    if (entries.at(-1)?.target.path === target.path) return;
    // Returning to an earlier detail restores its mounted controls and scroll position.
    const earlier = entries.findIndex(entry => entry.target.path === target.path);
    const next = earlier >= 0 ? entries.slice(0, earlier + 1) : [...entries, { key: ++nextKey.current, target, trigger: anchor }];
    setJourney({ locationKey: location.key, entries: next });
  };
  return <div ref={scope} className="club-preview-scope" style={{ overflowAnchor: 'none' }} onClickCapture={capture}>
    {children}
    {!!entries.length && <PreviewDrawer club={club} entries={entries} onClose={close} onBack={() => setJourney(current => ({ ...current, entries: current.entries.slice(0, -1) }))}/>}
  </div>;
}

function PreviewDrawer({ club, entries, onClose, onBack }: { club: ClubProfile; entries: Entry[]; onClose: () => void; onBack: () => void }) {
  const motion = useClubPanelMotion(onClose);
  const dialog = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), headingId = useId();
  const active = entries.at(-1)!;
  useDialogFocus(true, dialog, motion.close, heading);
  const prior = useRef(entries);
  useLayoutEffect(() => {
    const previous = prior.current;
    if (previous.at(-1)?.key !== active.key) {
      const returning = previous.length > entries.length ? previous[entries.length]?.trigger : null;
      (returning?.isConnected ? returning : heading.current)?.focus({ preventScroll: true });
    }
    prior.current = entries;
  }, [active.key, entries]);
  return <div className="club-preview-backdrop club-motion-backdrop" data-closing={motion.closing} onClick={motion.close}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={headingId} className="club-public club-preview-drawer club-motion-panel" data-closing={motion.closing} onAnimationEnd={motion.onAnimationEnd} onClick={event => event.stopPropagation()}>
      <header className="club-preview-heading">
        <div>{entries.length > 1 && <button className="cp-text-button club-preview-back" onClick={onBack}><ArrowLeft size={16}/>Back to {entries.at(-2)!.target.title}</button>}
          <p className="cp-eyebrow">Exploring from {club.name}</p><h2 id={headingId} ref={heading} tabIndex={-1}>{active.target.title}</h2>
        </div>
        <button className="cp-icon-button" aria-label="Close details" onClick={motion.close}><X size={21}/></button>
      </header>
      {entries.map(entry => <PreviewEntry key={entry.key} entry={entry} club={club} active={entry.key === active.key}/>)}
    </section>
  </div>;
}

function PreviewEntry({ entry, club, active }: { entry: Entry; club: ClubProfile; active: boolean }) {
  const [params, setParams] = useState(() => new URL(entry.target.path, window.location.origin).searchParams);
  const update: SetURLSearchParams = next => setParams(current => {
    const value = typeof next === 'function' ? next(new URLSearchParams(current)) : next;
    if (!value || typeof value === 'string' || Array.isArray(value) || value instanceof URLSearchParams) return new URLSearchParams(value);
    return new URLSearchParams(Object.entries(value).flatMap(([key, values]) => (Array.isArray(values) ? values : [values]).map(item => [key, item])));
  });
  const fullPage = new URL(entry.target.path, window.location.origin);
  fullPage.search = params.toString();
  return <><div hidden={!active} inert={!active} className="club-preview-body" style={!active ? { display: 'none' } : undefined}>
    <ErrorBoundary fallback={<p role="alert" className="cp-empty">These details could not be displayed. You can close this panel and try again; your club page is still in place.</p>}>
      <ClubPreviewActiveContext.Provider value={active}><ClubPreviewQueryContext.Provider value={[params, update]}><ClubPreviewContent target={entry.target} club={club}/></ClubPreviewQueryContext.Provider></ClubPreviewActiveContext.Provider>
    </ErrorBoundary>
  </div>{active && <footer className="club-preview-footer"><span>Your club page stays where you left it.</span><Link data-club-full-page to={fullPage.pathname + fullPage.search + fullPage.hash}>{entry.target.fullPageLabel}<ArrowUpRight size={16}/></Link></footer>}</>;
}
