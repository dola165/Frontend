import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PageView } from '../api';
import type { BoxKey } from '../model/kinds';
import type { PanelKey } from './context';

export interface BoxProps {
  page: PageView;
  /** Edit mode is on for this viewer. */
  editing: boolean;
  /** This box's own editor is open (`?panel=` names it); boxes that edit in place render their form then. */
  open: boolean;
  onEdit: () => void;
  onClose: () => void;
}

/** One box: how it looks when it has content, its ghost when it has none, and where it is edited. */
export interface BoxRenderer {
  View: ComponentType<BoxProps>;
  icon: LucideIcon;
  /** The ghost's three or four words, and a quieter line under them. */
  words: string;
  hint?: string;
  /** Edited in a panel (a map, a designer) rather than in place. */
  panel?: PanelKey;
  filled: (page: PageView) => boolean;
}
export type BoxRenderers = Partial<Record<BoxKey, BoxRenderer>>;
