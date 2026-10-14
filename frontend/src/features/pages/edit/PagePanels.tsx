import { lazy, Suspense } from 'react';
import { usePageEdit } from './context';

// Each panel loads when it opens: the map and the cropper are never on the page until needed.
const CrestPanel = lazy(() => import('./panels/CrestPanel').then(module => ({ default: module.CrestPanel })));
const CoverPanel = lazy(() => import('./panels/CoverPanel').then(module => ({ default: module.CoverPanel })));
const IdentityPanel = lazy(() => import('./panels/IdentityPanel').then(module => ({ default: module.IdentityPanel })));
const GroundsPanel = lazy(() => import('./panels/GroundsPanel').then(module => ({ default: module.GroundsPanel })));
const SquadsPanel = lazy(() => import('./panels/SquadsPanel').then(module => ({ default: module.SquadsPanel })));
const LivePanel = lazy(() => import('./panels/LivePanel').then(module => ({ default: module.LivePanel })));

/** The panel the address names (`?panel=`), for the boxes that need room: a map, a designer, a builder. */
export function PagePanels() {
  const { panel, editing } = usePageEdit();
  if (!editing || !panel) return null;
  const Panel = panel === 'crest' ? CrestPanel : panel === 'cover' ? CoverPanel : panel === 'identity' ? IdentityPanel : panel === 'grounds' ? GroundsPanel : panel === 'squads' ? SquadsPanel : panel === 'live' ? LivePanel : null;
  if (!Panel) return null;
  return <Suspense fallback={null}><Panel /></Suspense>;
}
