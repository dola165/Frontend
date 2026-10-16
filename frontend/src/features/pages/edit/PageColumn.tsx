import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePagesCopy } from '../copy';
import { addableBoxes, BOX_COLUMN, type BoxKey, type Column } from '../model/kinds';
import { GhostBox, type GhostNeed } from './GhostBox';
import { SETUP_PANEL, usePageEdit } from './context';
import { BOX_NAMES, ghostWords } from './words';
import { DraggableBox, SortableColumn, TrayItem } from './Rearrange';
import type { BoxRenderers } from './boxRegistry';
import './edit.css';

/** What an empty box means: a ground or a way to reach the page is needed to go live; money (store, jobs, fundraising) is advanced; the rest is recommended. */
// Only the name is needed to go live, so every box is recommended, the store, jobs and fundraising advanced.
const needOf = (key: BoxKey): GhostNeed => (key === 'involved' ? 'advanced' : 'recommended');

/** The boxes that just filled or just changed place light up for a moment, so the eye follows what happened. */
function useFlashes(keys: BoxKey[], filled: Record<string, boolean>): Set<BoxKey> {
  const [flashing, setFlashing] = useState<Set<BoxKey>>(() => new Set());
  const previous = useRef<{ order: string; filled: Record<string, boolean> } | null>(null);
  const order = keys.join(',');
  useEffect(() => {
    const before = previous.current;
    previous.current = { order, filled };
    if (!before) return;
    const changed = keys.filter(key => (before.filled[key] === false && filled[key]) || (before.order !== order && before.order.includes(key)));
    if (!changed.length) return;
    const show = window.setTimeout(() => setFlashing(new Set(changed)), 0);
    const hide = window.setTimeout(() => setFlashing(new Set()), 1400);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [keys, order, filled]);
  return flashing;
}

/** The box a step just opened comes on screen and lights up for a moment, so the eye lands on it. */
function useOpenedFlash(panel: string | null) {
  useEffect(() => {
    if (!panel) return;
    const node = document.querySelector<HTMLElement>(`[data-box="${panel}"]`);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight) node.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    node.setAttribute('data-opened', '');
    const timer = window.setTimeout(() => node.removeAttribute('data-opened'), 1600);
    return () => { clearTimeout(timer); node.removeAttribute('data-opened'); };
  }, [panel]);
}

/**
 * One column of a page: its boxes in the owner's order, each as its content or, in edit mode, as the ghost that
 * fills it. Visitors never see an empty box. In Rearrange mode every box gets a handle, Move up / Move down and
 * Hide, with a drop line between boxes; the tray of boxes not on the page yet ends the column in edit mode.
 */
export function PageColumn({ column, renderers }: { column: Column; renderers: BoxRenderers }) {
  const { page, editing, rearranging, panel, openPanel, closePanel } = usePageEdit();
  const keys = (page?.layout.columns[column] ?? []).filter(key => renderers[key]);
  const filled: Record<string, boolean> = {};
  for (const key of keys) filled[key] = page ? renderers[key]!.filled(page) : false;
  const flashing = useFlashes(keys, filled);
  useOpenedFlash(panel);
  if (!page) return null;
  const next = page.setup.next ? SETUP_PANEL[page.setup.next] : null;
  const boxes = keys.map((key, index) => {
        const renderer = renderers[key]!;
        if (!editing && !filled[key]) return null;
        const target = renderer.panel ?? key;
        const open = panel === key;
        const isNext = next === target;
        return (
          <div key={key} className="gk-boxframe" data-box={key} data-rearrange={rearranging || undefined} data-flash={flashing.has(key) || undefined}>
            {(() => { const content = filled[key] || (open && !renderer.panel)
              ? <renderer.View page={page} editing={editing && !rearranging} open={open} onEdit={() => openPanel(target)} onClose={closePanel} />
              : <GhostBox icon={renderer.icon} {...ghostWords(page.kind, key, renderer)} next={isNext} need={page.status === 'DRAFT' ? needOf(key) : undefined} onOpen={() => openPanel(target)} />;
              return rearranging ? <DraggableBox box={key} column={column} index={index} count={keys.length}>{content}</DraggableBox> : content; })()}
          </div>
        );
      });
  return (
    <>
      {rearranging ? <SortableColumn column={column} keys={keys}>{boxes}</SortableColumn> : boxes}
      {/* A draft shows only its own boxes and the next step; more boxes can be added once it is live. */}
      {editing && page.status === 'LIVE' && <AddBoxTray column={column} renderers={renderers} />}
    </>
  );
}

/** "+ Add a box": the boxes this column may still take; a tap adds one at its place in the fixed order, a drag where it is dropped. */
function AddBoxTray({ column, renderers }: { column: Column; renderers: BoxRenderers }) {
  const t = usePagesCopy();
  const { page, showBox } = usePageEdit();
  if (!page) return null;
  const choices = addableBoxes(page.kind, page.layout).filter(key => BOX_COLUMN[key] === column && renderers[key]);
  if (!choices.length) return null;
  return (
    <div className="gk-tray" role="group" aria-label={t('Add a box')}>
      <span className="gk-tray__label">{t('Add a box')}</span>
      {choices.map(key => {
        const Icon = renderers[key]!.icon;
        return <TrayItem key={key} box={key} onTap={() => void showBox(key)}><Plus aria-hidden="true" /><Icon aria-hidden="true" />{t(BOX_NAMES[key])}</TrayItem>;
      })}
    </div>
  );
}
