import { type ReactNode, useId, useState } from 'react';
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, EyeOff, GripVertical } from 'lucide-react';
import { Button } from '../../../design/primitives';
import { usePagesCopy } from '../copy';
import { BOX_COLUMN, FIXED_BOXES, isBoxKey, type BoxKey, type Column } from '../model/kinds';
import { usePageEdit } from './context';
import { BOX_NAMES } from './words';
import './edit.css';

/** What is being dragged: a box already on the page, or a box from the "+ Add a box" tray. */
type DragData = { kind: 'box'; box: BoxKey; column: Column } | { kind: 'tray'; box: BoxKey };
const dragData = (value: unknown): DragData | null => (value && typeof value === 'object' && 'kind' in value ? value as DragData : null);
/** What a drop landed on: a box (its column and place) or a column's empty end. */
const overOf = (value: unknown): { column: Column; box: BoxKey | null } | null => {
  if (!value || typeof value !== 'object') return null;
  const data = value as { kind?: string; box?: unknown; column?: Column };
  if (data.kind === 'box' && isBoxKey(data.box) && data.column) return { column: data.column, box: data.box };
  if (data.kind === 'column' && data.column) return { column: data.column, box: null };
  return null;
};

/**
 * Dragging on a page happens in two places only: from the tray onto the page, and in Rearrange mode within a column.
 * No free canvas. A box is grabbed anywhere on it and the others slide out of its way as it moves, as icons do on a
 * phone's home screen; letting go puts it there. Every drag has a non-drag alternative (Move up / Move down, the
 * tray's tap) and every move is announced. Wraps everything the columns and the tray render.
 */
export function RearrangeFrame({ children }: { children: ReactNode }) {
  const t = usePagesCopy();
  const { page, reorder, showBox } = usePageEdit();
  const [flying, setFlying] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const name = (box: BoxKey) => t(BOX_NAMES[box]);
  const onDragStart = (event: DragStartEvent) => setFlying(dragData(event.active.data.current));
  const onDragEnd = (event: DragEndEvent) => {
    setFlying(null);
    const data = dragData(event.active.data.current), over = overOf(event.over?.data.current);
    if (!data || !over || !page) return;
    if (BOX_COLUMN[data.box] !== over.column) return;
    const list = page.layout.columns[over.column];
    if (data.kind === 'tray') { void showBox(data.box, over.column, over.box ? list.indexOf(over.box) : list.length); return; }
    if (!over.box || over.box === data.box) return;
    void reorder(over.column, list.indexOf(data.box), list.indexOf(over.box));
  };
  const announcements = {
    onDragStart: ({ active }: { active: { data: { current?: unknown } } }) => { const data = dragData(active.data.current); return data ? t('Picked up {box}.', { box: name(data.box) }) : undefined; },
    onDragOver: ({ over }: { over: { data: { current?: unknown } } | null }) => { const target = overOf(over?.data.current); return target?.box ? t('Over {box}.', { box: name(target.box) }) : undefined; },
    onDragEnd: ({ active, over }: { active: { data: { current?: unknown } }; over: { data: { current?: unknown } } | null }) => { const data = dragData(active.data.current), target = overOf(over?.data.current); return data && target ? t('{box} placed.', { box: name(data.box) }) : t('Nothing moved.'); },
    onDragCancel: () => t('Nothing moved.'),
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setFlying(null)} accessibility={{ announcements, screenReaderInstructions: { draggable: t('Press space to pick up a box, the arrow keys to move it, space to drop it, Escape to cancel.') } }}>
      {children}
      <DragOverlay dropAnimation={null}>{flying?.kind === 'tray' ? <span className="gk-tray__item gk-tray__item--flying">{name(flying.box)}</span> : null}</DragOverlay>
    </DndContext>
  );
}

/** A column's boxes as a sortable list; the column itself takes a drop at its end. */
export function SortableColumn({ column, keys, children }: { column: Column; keys: BoxKey[]; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `column:${column}`, data: { kind: 'column', column } });
  return <SortableContext items={keys.map(key => `box:${key}`)} strategy={verticalListSortingStrategy}><div ref={setNodeRef} className="gk-sortcol">{children}</div></SortableContext>;
}

/**
 * A box in Rearrange mode: grabbed anywhere on it with the pointer (the tools row stays clickable: a drag needs a
 * few pixels of movement first), from the grip with the keyboard; it slides with the others while one flies.
 * Move up, Move down and Hide beside it.
 */
export function DraggableBox({ box, column, index, count, children }: { box: BoxKey; column: Column; index: number; count: number; children: ReactNode }) {
  const t = usePagesCopy();
  const { moveBox, hideBox } = usePageEdit();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `box:${box}`, data: { kind: 'box', box, column } satisfies DragData });
  const liveId = useId();
  const [said, setSaid] = useState('');
  const label = t(BOX_NAMES[box]);
  const move = async (delta: 1 | -1) => { await moveBox(box, delta); setSaid(t('{box} moved to position {n} of {count}.', { box: label, n: index + 1 + delta, count })); };
  return (
    <div ref={setNodeRef} className="gk-boxframe__drag" data-dragging={isDragging || undefined} style={{ transform: CSS.Transform.toString(transform), transition }} onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined}>
      <div className="gk-boxframe__tools">
        <button type="button" ref={setActivatorNodeRef} className="gk-btn gk-btn--ghost gk-btn--sm gk-btn--icon gk-boxframe__handle" aria-label={t('Drag {box}', { box: label })} title={t('Drag, or use the arrows')} onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined} {...attributes}><GripVertical aria-hidden="true" /></button>
        <Button size="sm" variant="ghost" iconOnly disabled={index === 0} aria-label={t('Move {box} up', { box: label })} title={t('Move up')} onClick={() => void move(-1)}><ArrowUp aria-hidden="true" /></Button>
        <Button size="sm" variant="ghost" iconOnly disabled={index >= count - 1} aria-label={t('Move {box} down', { box: label })} title={t('Move down')} onClick={() => void move(1)}><ArrowDown aria-hidden="true" /></Button>
        {!FIXED_BOXES.includes(box) && <Button size="sm" variant="ghost" iconOnly aria-label={t('Hide {box}', { box: label })} title={t('Hide')} onClick={() => void hideBox(box)}><EyeOff aria-hidden="true" /></Button>}
        <span id={liveId} className="gk-visually-hidden" role="status" aria-live="polite">{said}</span>
      </div>
      {children}
    </div>
  );
}

/** A chip in the tray that can be dragged onto the page as well as tapped. */
export function TrayItem({ box, children, onTap }: { box: BoxKey; children: ReactNode; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tray:${box}`, data: { kind: 'tray', box } satisfies DragData });
  return <button type="button" ref={setNodeRef} className="gk-tray__item" data-dragging={isDragging || undefined} onClick={onTap} {...listeners} {...attributes}>{children}</button>;
}
