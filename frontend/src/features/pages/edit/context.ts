import { createContext, useContext } from 'react';
import type { PageRef, PageView, SavableBox, saveIdentity as saveIdentityCall } from '../api';
import { BOX_KEYS, type BoxKey, type Column, type PageLayout, type SetupKey } from '../model/kinds';

/** What a panel edits: a box, the players' join links, or a part of the identity; `live` is the share card after going live. */
export type PanelKey = BoxKey | 'players' | 'crest' | 'cover' | 'identity' | 'live' | 'example';
const PANELS = new Set<string>([...BOX_KEYS, 'players', 'crest', 'cover', 'identity', 'live', 'example']);
export const isPanelKey = (value: string | null): value is PanelKey => value != null && PANELS.has(value);
/** The panel that fills each setup item. */
export const SETUP_PANEL: Record<SetupKey, PanelKey> = { name: 'identity', crest: 'crest', grounds: 'grounds', squads: 'squads', contact: 'contact', fees: 'fees', players: 'players', staff: 'staff', posts: 'identity', about: 'identity', sponsors: 'sponsors' };

export type IdentityPatch = Parameters<typeof saveIdentityCall>[2];
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
export interface SaveOptions { label?: string; undoable?: boolean; optimistic?: (page: PageView) => PageView }

export interface PageEdit {
  pageRef: PageRef;
  page: PageView | null;
  loading: boolean;
  failed: boolean;
  notFound: boolean;
  retry: () => void;
  /** The viewer may edit, and edit mode is on (`?edit=1`). A non-owner never gets edit mode, whatever the address says. */
  editing: boolean;
  canEdit: boolean;
  setEditing: (on: boolean) => void;
  panel: PanelKey | null;
  openPanel: (key: PanelKey) => void;
  /** Opens a set-up step where it is done: its panel or box, or the About right under the name. */
  openStep: (key: SetupKey) => void;
  closePanel: () => void;
  /** Rearrange mode (`?rearrange=1`): boxes get handles, Move up / Move down and Hide. */
  rearranging: boolean;
  setRearranging: (on: boolean) => void;
  /** Opened the first time, just created or just claimed: the hint is shown once. */
  arrival: 'new' | 'claimed' | null;
  status: SaveStatus;
  pendingCount: number;
  saveIdentity: (patch: IdentityPatch, options?: SaveOptions) => Promise<boolean>;
  saveBox: <K extends SavableBox>(key: K, data: unknown, options?: SaveOptions) => Promise<boolean>;
  saveLayout: (layout: PageLayout, options?: SaveOptions) => Promise<boolean>;
  hideBox: (key: BoxKey) => Promise<void>;
  showBox: (key: BoxKey, column?: Column, index?: number) => Promise<void>;
  moveBox: (key: BoxKey, delta: 1 | -1) => Promise<void>;
  reorder: (column: Column, from: number, to: number) => Promise<void>;
  goLive: () => Promise<boolean>;
  replace: (page: PageView) => void;
}

export const PageEditContext = createContext<PageEdit | null>(null);
export function usePageEdit(): PageEdit {
  const value = useContext(PageEditContext);
  if (!value) throw new Error('usePageEdit must be used inside PageEditProvider.');
  return value;
}
/** Null outside a page: components shared with pages that are not editable (the club page's own blocks) read this. */
export const usePageEditIfAny = () => useContext(PageEditContext);
