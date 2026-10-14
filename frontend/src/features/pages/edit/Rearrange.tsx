import { type ReactNode, useId, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, EyeOff, GripVertical } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import { BOX_COLUMN, FIXED_BOXES, type BoxKey, type Column } from '../model/kinds';
import { usePageEdit } from './context';
import { BOX_NAMES } from './words';
import './edit.css';

/** What is being dragged: a box already on the page, or a box from the "+ Add a box" tray. */
type DragData = { kind: 'box'; box: BoxKey; column: Column } | { kind: 'tray'; box: BoxKey };
type GapData = { column: Column; index: number };
const dragData = (value: unknown): DragData | null => (value && typeof value === 'object' && 'kind' in value ? value as DragData : null);
const gapData = (value: unknown): GapData | null => (value && typeof value === 'object' && 'column' in value && 'index' in value ? value as GapData : null);

/**
 * Dragging on a page happens in two places only: from the tray onto the page, and in Rearrange mode within a column.
 * No free canvas. Every drag has a non-drag alternative (Move up / Move down, the tray's tap) and every move is
 * announced. Wraps everything the columns and the tray render.
 */
export function RearrangeFrame({ children }: { children: ReactNode }) {
  const t = usePagesCopy();
  const { page, reorder, showBox } = usePageEdit();
  const [dragging, setDragging] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const name = (box: BoxKey) => t(BOX_NAMES[box]);
  const onDragStart = (event: DragStartEvent) => setDragging(dragData(event.active.data.current));
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const data = dragData(event.active.data.current), gap = gapData(event.over?.data.current);
    if (!data || !gap || !page) return;
    if (BOX_COLUMN[data.box] !== gap.column) return;
    if (data.kind === 'tray') { void showBox(data.box, gap.column, gap.index); return; }
    const from = page.layout.columns[gap.column].indexOf(data.box);
    const to = gap.index > from ? gap.index - 1 : gap.index;
    void reorder(gap.column, from, to);
  };
  const announcements = {
    onDragStart: ({ active }: { active: { data: { current?: unknown } } }) => { const data = dragData(active.data.current); return data ? t('Picked up {box}.', { box: name(data.box) }) : undefined; },
    onDragOver: ({ over }: { over: { data: { current?: unknown } } | null }) => { const gap = gapData(over?.data.current); return gap ? t('Over position {n}.', { n: gap.index + 1 }) : undefined; },
    onDragEnd: ({ active, over }: { active: { data: { current?: unknown } }; over: { data: { current?: unknown } } | null }) => { const data = dragData(active.data.current), gap = gapData(over?.data.current); return data && gap ? t('{box} placed at position {n}.', { box: name(data.box), n: gap.index + 1 }) : t('Nothing moved.'); },
    onDragCancel: () => t('Nothing moved.'),
  };
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} accessibility={{ announcements, screenReaderInstructions: { draggable: t('Press space to pick up a box, the arrow keys to move it, space to drop it. Or use Move up and Move down.') } }}>
      {children}
      <DragOverlay dropAnimation={null}>{dragging ? <span className="gk-tray__item gk-tray__item--flying">{name(dragging.box)}</span> : null}</DragOverlay>
    </DndContext>
  );
}

/** A thin line between boxes that lights up while a box hovers over it. Only in Rearrange mode or while something flies. */
export function DropGap({ column, index }: GapData) {
  const { setNodeRef, isOver } = useDroppable({ id: `gap:${column}:${index}`, data: { column, index } satisfies GapData });
  return <div ref={setNodeRef} className="gk-boxframe__drop" data-over={isOver || undefined} aria-hidden="true" />;
}

/** A box's handle and its non-drag alternatives in Rearrange mode: Move up, Move down, Hide (except the fixed boxes). */
export function BoxTools({ box, column, index, count }: { box: BoxKey; column: Column; index: number; count: number }) {
  const t = usePagesCopy();
  const { moveBox, hideBox } = usePageEdit();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `box:${box}`, data: { kind: 'box', box, column } satisfies DragData });
  const liveId = useId();
  const [said, setSaid] = useState('');
  const label = t(BOX_NAMES[box]);
  const move = async (delta: 1 | -1) => { await moveBox(box, delta); setSaid(t('{box} moved to position {n} of {count}.', { box: label, n: index + 1 + delta, count })); };
  return (
    <div className="gk-boxframe__tools" data-dragging={isDragging || undefined}>
      <button type="button" ref={setNodeRef} className="gk-btn gk-btn--ghost gk-btn--sm gk-btn--icon gk-boxframe__handle" aria-label={t('Drag {box}', { box: label })} title={t('Drag')} {...listeners} {...attributes}><GripVertical aria-hidden="true" /></button>
      <Button size="sm" variant="ghost" iconOnly disabled={index === 0} aria-label={t('Move {box} up', { box: label })} title={t('Move up')} onClick={() => void move(-1)}><ArrowUp aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" iconOnly disabled={index >= count - 1} aria-label={t('Move {box} down', { box: label })} title={t('Move down')} onClick={() => void move(1)}><ArrowDown aria-hidden="true" /></Button>
      {!FIXED_BOXES.includes(box) && <Button size="sm" variant="ghost" iconOnly aria-label={t('Hide {box}', { box: label })} title={t('Hide')} onClick={() => void hideBox(box)}><EyeOff aria-hidden="true" /></Button>}
      <span id={liveId} className="gk-visually-hidden" role="status" aria-live="polite">{said}</span>
    </div>
  );
}

/** A chip in the tray that can be dragged onto the page as well as tapped. */
export function TrayItem({ box, children, onTap }: { box: BoxKey; children: ReactNode; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tray:${box}`, data: { kind: 'tray', box } satisfies DragData });
  return <button type="button" ref={setNodeRef} className="gk-tray__item" data-dragging={isDragging || undefined} onClick={onTap} {...listeners} {...attributes}>{children}</button>;
}
