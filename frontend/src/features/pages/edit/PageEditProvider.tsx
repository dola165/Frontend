import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { recordFunnelEvent } from '../../feed/feedEvents';
import { isRecord, readSetupRecovery, writeSetupRecovery, clearSetupRecovery } from '../../organizations/setup/setupRecovery';
import { PageConflict, fetchPage, isPageView, goLive as goLiveCall, saveBox as saveBoxCall, saveIdentity as saveIdentityCall, saveLayout as saveLayoutCall, type PageIdentity, type PageRef, type PageView, type SavableBox } from '../api';
import { PageEditContext, SETUP_PANEL, isPanelKey, type IdentityPatch, type PageEdit, type PanelKey, type SaveOptions, type SaveStatus } from './context';
import { pt } from '../copy';
import { BOX_COLUMN, insertionIndex, type BoxKey, type Column, type PageLayout, type SetupKey } from '../model/kinds';
import { boxData } from './boxData';

/** An edit that could not be sent: kept in the tab and sent again when the page opens next. */
type PendingEdit = { kind: 'identity'; patch: IdentityPatch } | { kind: 'box'; key: SavableBox; data: unknown } | { kind: 'layout'; layout: PageLayout };
const pendingKey = (ref: PageRef) => `page-pending:${ref.type}:${ref.id}`;
const validPending = (value: unknown): value is PendingEdit[] => Array.isArray(value) && value.every(item => isRecord(item) && typeof item.kind === 'string');
const EDIT = 'edit', PANEL = 'panel', REARRANGE = 'rearrange';

/**
 * One page under edit: the page as read, edit mode and its open panel in the address, and every save optimistic,
 * autosaved and undoable. Every write carries the version it read; a lost race shows theirs with "Keep mine". An edit
 * the network dropped is kept in the tab and sent when the page opens next, so leaving never loses work.
 */
export function PageEditProvider({ pageRef: ref, children }: { pageRef: PageRef; children: ReactNode }) {
  // One object per page, whatever the parent passes each render: the fetch and the saves key on it.
  const pageRef = useMemo<PageRef>(() => ({ type: ref.type, id: ref.id }), [ref.type, ref.id]);
  const { user, sessionId, status: auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  // A page claimed from the sheet over it is read again on arrival: the claim made this person its owner.
  const justClaimed = new URLSearchParams(location.search).get('claimed') === '1';
  const key = `${pageRef.type}:${pageRef.id}:${sessionId}:${attempt}:${justClaimed ? 'claimed' : ''}`;
  const [loaded, setLoaded] = useState<{ key: string; page: PageView | null; failed: boolean; notFound: boolean } | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const userId = user?.id;
  const [pending, setPending] = useState<PendingEdit[]>(() => readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? []);
  const pageState = useRef<PageView | null>(null);
  const idleTimer = useRef<number | null>(null);
  const replayed = useRef('');

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(pageRef, controller.signal)
      // An answer that is not a page (a backend without pages yet) counts as no page: the older presentation takes over.
      .then(page => { if (!controller.signal.aborted) setLoaded({ key, page: isPageView(page) ? page : null, failed: false, notFound: !isPageView(page) }); })
      .catch(error => { if (!controller.signal.aborted) setLoaded({ key, page: null, failed: error?.response?.status !== 404, notFound: error?.response?.status === 404 }); });
    return () => controller.abort();
  }, [key, pageRef]);

  const page = loaded?.key.startsWith(`${pageRef.type}:${pageRef.id}:${sessionId}:`) ? loaded.page : null;
  // Saves read the page as it is when they run, not as it was when their callback was made.
  useEffect(() => { pageState.current = page; }, [page]);
  const loading = loaded?.key !== key;
  const replace = useCallback((next: PageView) => { pageState.current = next; setLoaded(current => (current ? { ...current, page: next } : current)); }, []);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const canEdit = auth === 'authenticated' && Boolean(page?.viewer.canEdit);
  const editing = canEdit && params.get(EDIT) === '1';
  const requested = params.get(PANEL);
  const panel = editing && isPanelKey(requested) ? requested : null;
  const rearranging = editing && params.get(REARRANGE) === '1';
  const arrival = editing ? (params.get('new') === '1' ? 'new' : params.get('claimed') === '1' ? 'claimed' : null) : null;

  const go = useCallback((change: (next: URLSearchParams) => void, push = false) => {
    const next = new URLSearchParams(location.search);
    change(next);
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: !push });
  }, [location.hash, location.pathname, location.search, navigate]);
  const setEditing = useCallback((on: boolean) => go(next => { if (on) next.set(EDIT, '1'); else next.delete(EDIT); for (const drop of [PANEL, REARRANGE, 'new', 'claimed', 'steps']) next.delete(drop); }), [go]);
  const setRearranging = useCallback((on: boolean) => go(next => { next.set(EDIT, '1'); next.delete(PANEL); if (on) next.set(REARRANGE, '1'); else next.delete(REARRANGE); }), [go]);
  // A panel is a step in history, so Back closes it.
  const openPanel = useCallback((next: PanelKey) => go(search => { search.set(EDIT, '1'); search.set(PANEL, next); search.delete(REARRANGE); search.delete('new'); search.delete('claimed'); if (next === 'live') search.delete('steps'); }, true), [go]);
  const closePanel = useCallback(() => go(next => next.delete(PANEL)), [go]);
  // The About is no panel: it is typed where it shows, so its step turns edit mode on and opens that line.
  const openStep = useCallback((step: SetupKey) => {
    if (step !== 'about') { openPanel(SETUP_PANEL[step]); return; }
    go(next => { next.set(EDIT, '1'); next.delete(PANEL); next.delete(REARRANGE); });
    let tries = 0;
    const open = () => { const button = document.querySelector<HTMLButtonElement>('[data-step="about"] .gk-inline__open'); if (button) button.click(); else if (++tries < 20) window.setTimeout(open, 50); };
    window.setTimeout(open, 0);
  }, [go, openPanel]);

  const settle = useCallback((next: SaveStatus) => {
    setStatus(next);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (next === 'saved') idleTimer.current = window.setTimeout(() => setStatus('idle'), 2500);
  }, []);
  const keep = useCallback((edit: PendingEdit) => setPending(current => { const next = [...current, edit]; writeSetupRecovery(userId, pendingKey(pageRef), next); return next; }), [pageRef, userId]);

  /** Runs one save: optimistic first, then the server's answer; a lost race shows theirs; a failure offers to try again. */
  const runRef = useRef<(op: (current: PageView) => Promise<PageView>, options?: SaveOptions & { undo?: (current: PageView) => Promise<PageView>; remember?: PendingEdit }) => Promise<boolean>>(async () => false);
  const run = useCallback(async (op: (current: PageView) => Promise<PageView>, options: SaveOptions & { undo?: (current: PageView) => Promise<PageView>; remember?: PendingEdit } = {}): Promise<boolean> => {
    const before = pageState.current;
    if (!before) return false;
    if (options.optimistic) replace(options.optimistic(before));
    settle('saving');
    try {
      const next = await op(before);
      replace(next);
      settle('saved');
      const undo = options.undo;
      if (options.label) toast(options.label, undo && options.undoable !== false ? { action: { label: pt('Undo'), onClick: () => { void runRef.current(undo, { label: pt('Undone') }); } } } : undefined);
      return true;
    } catch (error) {
      if (error instanceof PageConflict) {
        replace(error.current);
        settle('idle');
        toast.warning(pt('Someone just changed this.'), { description: pt('Theirs is shown. Keep yours instead?'), action: { label: pt('Keep mine'), onClick: () => { void runRef.current(op, options); } } });
        return false;
      }
      if (options.optimistic) replace(before);
      settle('failed');
      if (options.remember) keep(options.remember);
      toast.error(extractApiErrorMessage(error, pt('Not saved. Check your connection and try again.')), { action: { label: pt('Try again'), onClick: () => { void runRef.current(op, options); } } });
      return false;
    }
  }, [keep, replace, settle]);
  useEffect(() => { runRef.current = run; }, [run]);

  const saveIdentity = useCallback(async (patch: IdentityPatch, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return;
    const previous = Object.fromEntries(Object.keys(patch).map(field => [field, before.identity[field as keyof PageIdentity]])) as IdentityPatch;
    await run(current => saveIdentityCall(pageRef, current.identity.version, patch), { ...options, undo: current => saveIdentityCall(pageRef, current.identity.version, previous), remember: { kind: 'identity', patch } });
  }, [pageRef, run]);

  const saveBox = useCallback(async <K extends SavableBox>(boxKey: K, data: unknown, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return;
    const previous = boxData(boxKey, before.boxes[boxKey]);
    const wasDone = before.setup.items.find(item => item.key === (boxKey as string))?.done;
    const ok = await run(current => saveBoxCall(pageRef, boxKey, current.boxes[boxKey].version, data), { ...options, undo: current => saveBoxCall(pageRef, boxKey, current.boxes[boxKey].version, previous), remember: { kind: 'box', key: boxKey, data } });
    const after = pageState.current;
    if (ok && after && !wasDone && after.setup.items.find(item => item.key === (boxKey as string))?.done) recordFunnelEvent('PAGE_BOX_FILLED', { box: boxKey, pageRef: `${pageRef.type}-${pageRef.id}` });
  }, [pageRef, run]);

  const saveLayout = useCallback(async (layout: PageLayout, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return;
    const previous: PageLayout = { columns: before.layout.columns, hidden: before.layout.hidden };
    await run(current => saveLayoutCall(pageRef, current.layout.version, layout), {
      optimistic: current => ({ ...current, layout: { ...current.layout, ...layout } }), ...options,
      undo: current => saveLayoutCall(pageRef, current.layout.version, previous), remember: { kind: 'layout', layout },
    });
  }, [pageRef, run]);

  const layoutOf = (current: PageView): PageLayout => ({ columns: { left: [...current.layout.columns.left], main: [...current.layout.columns.main], right: [...current.layout.columns.right] }, hidden: [...current.layout.hidden] });
  const hideBox = useCallback(async (boxKey: BoxKey) => {
    const current = pageState.current; if (!current) return;
    const layout = layoutOf(current);
    const column = BOX_COLUMN[boxKey];
    layout.columns[column] = layout.columns[column].filter(item => item !== boxKey);
    if (!layout.hidden.includes(boxKey)) layout.hidden.push(boxKey);
    await saveLayout(layout, { label: pt('Box hidden. Its content is kept.') });
  }, [saveLayout]);
  const showBox = useCallback(async (boxKey: BoxKey, column: Column = BOX_COLUMN[boxKey], index?: number) => {
    const current = pageState.current; if (!current) return;
    const layout = layoutOf(current);
    const target = BOX_COLUMN[boxKey] === column ? column : BOX_COLUMN[boxKey];
    layout.hidden = layout.hidden.filter(item => item !== boxKey);
    if (!layout.columns[target].includes(boxKey)) layout.columns[target].splice(index ?? insertionIndex(layout, boxKey), 0, boxKey);
    await saveLayout(layout, { label: pt('Box added') });
  }, [saveLayout]);
  const reorder = useCallback(async (column: Column, from: number, to: number) => {
    const current = pageState.current; if (!current || from === to) return;
    const layout = layoutOf(current);
    const list = layout.columns[column];
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await saveLayout(layout, { label: pt('Moved') });
  }, [saveLayout]);
  const moveBox = useCallback(async (boxKey: BoxKey, delta: 1 | -1) => {
    const current = pageState.current; if (!current) return;
    const column = BOX_COLUMN[boxKey];
    const from = current.layout.columns[column].indexOf(boxKey);
    await reorder(column, from, from + delta);
  }, [reorder]);

  const goLive = useCallback(async () => {
    const ok = await run(() => goLiveCall(pageRef, crypto.randomUUID()), { label: pt('Your page is live') });
    if (ok) { recordFunnelEvent('PAGE_LIVE', { pageRef: `${pageRef.type}-${pageRef.id}` }); openPanel('live'); }
    return ok;
  }, [openPanel, pageRef, run]);

  // Edits the network dropped last time are sent now, once, in order.
  useEffect(() => {
    if (!page || !canEdit || replayed.current === key) return;
    replayed.current = key;
    const kept = readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [];
    if (!kept.length) return;
    clearSetupRecovery(userId, pendingKey(pageRef));
    void (async () => {
      await Promise.resolve();
      setPending([]);
      for (const edit of kept) {
        if (edit.kind === 'identity') await saveIdentity(edit.patch, { label: pt('Saved what you changed last time') });
        else if (edit.kind === 'box') await saveBox(edit.key, edit.data, { label: pt('Saved what you changed last time') });
        else await saveLayout(edit.layout);
      }
    })();
  }, [canEdit, key, page, pageRef, saveBox, saveIdentity, saveLayout, userId]);

  const failed = Boolean(loaded?.key === key && loaded.failed), notFound = Boolean(loaded?.key === key && loaded.notFound);
  const value = useMemo<PageEdit>(() => ({
    pageRef, page, loading, failed, notFound, retry: () => setAttempt(value => value + 1),
    editing, canEdit, setEditing, panel, openPanel, openStep, closePanel, rearranging, setRearranging, arrival, status, pendingCount: pending.length,
    saveIdentity, saveBox, saveLayout, hideBox, showBox, moveBox, reorder, goLive, replace,
  }), [arrival, canEdit, closePanel, editing, failed, goLive, hideBox, loading, moveBox, notFound, openPanel, openStep, page, pageRef, panel, pending.length, rearranging, reorder, replace, saveBox, saveIdentity, saveLayout, setEditing, setRearranging, showBox, status]);
  return <PageEditContext.Provider value={value}>{children}</PageEditContext.Provider>;
}
