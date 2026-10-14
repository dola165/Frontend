import { Plus } from 'lucide-react';
import { usePagesCopy } from '../copy';
import { addableBoxes, BOX_COLUMN, type Column } from '../model/kinds';
import { GhostBox } from './GhostBox';
import { SETUP_PANEL, usePageEdit } from './context';
import { BOX_NAMES } from './words';
import type { BoxRenderers } from './boxRegistry';
import './edit.css';

/**
 * One column of a page: its boxes in the owner's order, each as its content or, in edit mode, as the ghost that
 * fills it. Visitors never see an empty box. The tray of boxes not on the page yet ends the column in edit mode.
 */
export function PageColumn({ column, renderers }: { column: Column; renderers: BoxRenderers }) {
  const { page, editing, panel, openPanel, closePanel } = usePageEdit();
  if (!page) return null;
  const keys = page.layout.columns[column];
  const next = page.setup.next ? SETUP_PANEL[page.setup.next] : null;
  return (
    <>
      {keys.map(key => {
        const renderer = renderers[key];
        if (!renderer) return null;
        const filled = renderer.filled(page);
        if (!editing && !filled) return null;
        const target = renderer.panel ?? key;
        const open = panel === key;
        return (
          <div key={key} className="gk-boxframe" data-box={key}>
            {filled || (open && !renderer.panel)
              ? <renderer.View page={page} editing={editing} open={open} onEdit={() => openPanel(target)} onClose={closePanel} />
              : <GhostBox icon={renderer.icon} words={renderer.words} hint={renderer.hint} next={next === target} onOpen={() => openPanel(target)} />}
          </div>
        );
      })}
      {editing && <AddBoxTray column={column} renderers={renderers} />}
    </>
  );
}

/** "+ Add a box": the boxes this column may still take; a tap adds one at its place in the fixed order. */
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
        return <button key={key} type="button" className="gk-tray__item" onClick={() => void showBox(key)}><Plus aria-hidden="true" /><Icon aria-hidden="true" />{t(BOX_NAMES[key])}</button>;
      })}
    </div>
  );
}
