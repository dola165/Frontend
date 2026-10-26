import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { isCurrentAuthSession } from '../../../utils/authStorage';
import { isRecord, readSetupRecovery, writeSetupRecovery, clearSetupRecovery } from '../../organizations/setup/setupRecovery';
import { PageConflict, fetchPage, isPageView, goLive as goLiveCall, saveBox as saveBoxCall, saveIdentity as saveIdentityCall, saveLayout as saveLayoutCall, type PageIdentity, type PageRef, type PageView, type SavableBox } from '../api';
import { PageEditContext, SETUP_PANEL, isPanelKey, type IdentityPatch, type PageEdit, type PanelKey, type SaveOptions, type SaveStatus } from './context';
import { pt } from '../copy';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { BOX_COLUMN, insertionIndex, type BoxKey, type Column, type PageLayout, type SetupKey } from '../model/kinds';
import { boxData } from './boxData';

/** An edit that could not be sent: kept in the tab and sent again when the page opens next. The id ties it to its retries. */
type PendingEdit = ({ kind: 'identity'; patch: IdentityPatch } | { kind: 'box'; key: SavableBox; data: unknown } | { kind: 'layout'; layout: PageLayout }) & { id?: string };
type RunOptions = SaveOptions & { undo?: (current: PageView) => Promise<PageView>; remember?: PendingEdit; replay?: boolean; retry?: () => void };
/** A saved edit makes a remembered one stale when it is the same edit (its retry) or covers everything the remembered one changed. */
const supersedes = (saved: PendingEdit, kept: PendingEdit) => (saved.id != null && saved.id === kept.id)
  || (saved.kind === 'identity' && kept.kind === 'identity' ? Object.keys(kept.patch).every(field => field in saved.patch)
    : saved.kind === 'box' && kept.kind === 'box' ? saved.key === kept.key : saved.kind === 'layout' && kept.kind === 'layout');
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
  const userId = user?.id;
  const accountPage = `${pageRef.type}:${pageRef.id}:${userId}:${sessionId}`;
  const key = `${accountPage}:${attempt}`;
  const scope = useMemo(() => ({ key, auth }), [key, auth]);
  // Only receipts present on entry belong to recovery. A consumer can save as soon as the page appears,
  // before the passive replay effect runs; that new receipt must not become a second automatic request.
  const recovery = useMemo(() => ({ scope, edits: readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [] }), [scope, pageRef, userId]);
  const [loaded, setLoaded] = useState<{ key: string; page: PageView | null; failed: boolean; notFound: boolean } | null>(null);
  const [saveState, setSaveState] = useState<{ scope: object | null; value: SaveStatus }>({ scope: null, value: 'idle' });
  const status = saveState.scope === scope ? saveState.value : 'idle';
  const [, setPendingRevision] = useState(0);
  const pending = readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [];
  const pageState = useRef<PageView | null>(null);
  const idleTimer = useRef<number | null>(null);
  const replayed = useRef<object | null>(null);
  const lease = useRef<{ scope: object } | null>(null);
  const publication = useRef<{ scope: object; requestId: string; promise: Promise<boolean> | null } | null>(null);
  // Old callbacks cannot regain a lease after unmount, account/session/page changes, or an explicit reload.
  useLayoutEffect(() => {
    const origin = { scope };
    lease.current = origin;
    return () => {
      if (lease.current === origin) lease.current = null;
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [scope]);
  const isActive = useCallback((origin = lease.current) => origin != null && lease.current === origin
    && origin.scope === scope && auth === 'authenticated' && isCurrentAuthSession(sessionId), [auth, scope, sessionId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(pageRef, controller.signal)
      // An answer that is not a page (a backend without pages yet) counts as no page: the older presentation takes over.
      .then(page => { if (!controller.signal.aborted) setLoaded({ key, page: isPageView(page) ? page : null, failed: false, notFound: !isPageView(page) }); })
      .catch(error => { if (!controller.signal.aborted) setLoaded({ key, page: null, failed: error?.response?.status !== 404, notFound: error?.response?.status === 404 }); });
    return () => controller.abort();
  }, [key, pageRef]);

  const page = loaded?.key.startsWith(`${accountPage}:`) ? loaded.page : null;
  // Saves read the page as it is when they run, not as it was when their callback was made.
  useLayoutEffect(() => { pageState.current = page; }, [page]);
  const loading = loaded?.key !== key;
  const replace = useCallback((next: PageView) => { if (!isActive()) return; pageState.current = next; setLoaded(current => (current ? { ...current, page: next } : current)); }, [isActive]);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const canEdit = auth === 'authenticated' && Boolean(page?.viewer.canEdit);
  const editing = canEdit && params.get(EDIT) === '1';
  const requested = params.get(PANEL);
  const panel = editing && isPanelKey(requested) ? requested : null;
  const rearranging = editing && params.get(REARRANGE) === '1';
  const arrival = editing && params.get('new') === '1' ? 'new' : null;

  const go = useCallback((change: (next: URLSearchParams) => void, push = false) => {
    const next = new URLSearchParams(location.search);
    change(next);
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: !push });
  }, [location.hash, location.pathname, location.search, navigate]);
  const setEditing = useCallback((on: boolean) => go(next => { if (on) next.set(EDIT, '1'); else next.delete(EDIT); for (const drop of [PANEL, REARRANGE, 'new', 'steps']) next.delete(drop); }), [go]);
  const setRearranging = useCallback((on: boolean) => go(next => { next.set(EDIT, '1'); next.delete(PANEL); if (on) next.set(REARRANGE, '1'); else next.delete(REARRANGE); }), [go]);
  // A panel is a step in history, so Back closes it.
  const openPanel = useCallback((next: PanelKey) => go(search => { search.set(EDIT, '1'); search.set(PANEL, next); search.delete(REARRANGE); search.delete('new'); if (next === 'live') search.delete('steps'); }, true), [go]);
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
    if (!isActive()) return;
    setSaveState({ scope, value: next });
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (next === 'saved') idleTimer.current = window.setTimeout(() => { if (isActive()) setSaveState({ scope, value: 'idle' }); }, 2500);
  }, [isActive, scope]);
  const store = useCallback((next: PendingEdit[]) => {
    if (!isActive()) return;
    if (next.length) writeSetupRecovery(userId, pendingKey(pageRef), next); else clearSetupRecovery(userId, pendingKey(pageRef));
    setPendingRevision(value => value + 1);
  }, [isActive, pageRef, userId]);
  const keep = useCallback((edit: PendingEdit) => {
    const kept = readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [];
    const index = edit.id ? kept.findIndex(item => item.id === edit.id) : -1;
    store(index < 0 ? [...kept, edit] : kept.map((item, i) => i === index ? edit : item));
  }, [pageRef, store, userId]);
  // Replay retires only its receipt. Newer manual saves may cover older edits, never a newer unsent tail.
  const retire = useCallback((saved: PendingEdit, replay = false) => {
    const kept = readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [];
    const index = kept.findIndex(item => item.id === saved.id);
    if (index < 0) return;
    store(kept.filter((item, i) => i !== index && (replay || i > index || !supersedes(saved, item))));
  }, [pageRef, store, userId]);

  /** Runs one save: optimistic first, then the server's answer; a lost race shows theirs; a failure offers to try again. */
  const runRef = useRef<(op: (current: PageView) => Promise<PageView>, options?: RunOptions) => Promise<boolean>>(async () => false);
  const run = useCallback(async (op: (current: PageView) => Promise<PageView>, options: RunOptions = {}): Promise<boolean> => {
    const origin = lease.current;
    const current = () => isActive(origin);
    const before = pageState.current;
    if (!current() || !before?.viewer.canEdit) return false;
    // Keep the receipt before sending: unmounting or losing the reply must not discard this account's answer.
    if (options.remember) keep(options.remember);
    if (options.optimistic) replace(options.optimistic(before));
    settle('saving');
    const retry = () => {
      if (!current()) return;
      if (options.remember && !(readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? []).some(item => item.id === options.remember?.id)) return;
      if (options.retry) { options.retry(); return; }
      void runRef.current(op, options);
    };
    try {
      if (!current()) return false;
      const next = await op(before);
      if (!current()) return false;
      replace(next);
      settle('saved');
      if (options.remember) retire(options.remember, options.replay);
      const undo = options.undo;
      if (options.label) toast(options.label, undo && options.undoable !== false ? { action: { label: pt('Undo'), onClick: () => { if (current()) void runRef.current(undo, { label: pt('Undone') }); } } } : undefined);
      return true;
    } catch (error) {
      if (!current()) return false;
      if (error instanceof PageConflict) {
        replace(error.current);
        settle('idle');
        toast.warning(pt('Someone just changed this.'), { description: pt('Your draft is kept. Keep yours instead?'), action: { label: pt('Keep mine'), onClick: retry } });
        return false;
      }
      if (options.optimistic) replace(before);
      settle('failed');
      // Publishing and inviting need a confirmed email: say so where it was pressed, with Resend.
      if (promptEmailConfirmation(error)) return false;
      toast.error(extractApiErrorMessage(error, pt('Not saved. Check your connection and try again.')), { action: { label: pt('Try again'), onClick: retry } });
      return false;
    }
  }, [isActive, keep, pageRef, replace, retire, settle, userId]);
  useLayoutEffect(() => { runRef.current = run; }, [run]);

  const saveIdentity = useCallback(async (patch: IdentityPatch, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return false;
    const previous = Object.fromEntries(Object.keys(patch).map(field => [field, before.identity[field as keyof PageIdentity]])) as IdentityPatch;
    return run(current => saveIdentityCall(pageRef, current.identity.version, patch), { ...options, undo: current => saveIdentityCall(pageRef, current.identity.version, previous), remember: { kind: 'identity', patch, id: crypto.randomUUID() } });
  }, [pageRef, run]);

  const saveBox = useCallback(async <K extends SavableBox>(boxKey: K, data: unknown, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return false;
    const previous = boxData(boxKey, before.boxes[boxKey]);
    const ok = await run(current => saveBoxCall(pageRef, boxKey, current.boxes[boxKey].version, data), { ...options, undo: current => saveBoxCall(pageRef, boxKey, current.boxes[boxKey].version, previous), remember: { kind: 'box', key: boxKey, data, id: crypto.randomUUID() } });
    return ok && isActive();
  }, [isActive, pageRef, run]);

  const saveLayout = useCallback(async (layout: PageLayout, options: SaveOptions = {}) => {
    const before = pageState.current; if (!before) return false;
    const previous: PageLayout = { columns: before.layout.columns, hidden: before.layout.hidden };
    return run(current => saveLayoutCall(pageRef, current.layout.version, layout), {
      optimistic: current => ({ ...current, layout: { ...current.layout, ...layout } }), ...options,
      undo: current => saveLayoutCall(pageRef, current.layout.version, previous), remember: { kind: 'layout', layout, id: crypto.randomUUID() },
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

  const goLive = useCallback(async function publish(): Promise<boolean> {
    const origin = lease.current;
    if (!isActive(origin) || !pageState.current?.viewer.canEdit) return false;
    let receipt = publication.current?.scope === scope ? publication.current : null;
    if (receipt?.promise) return receipt.promise;
    if (pageState.current.status === 'LIVE') { openPanel('live'); return true; }
    // One publish intent keeps its id after an unknown reply, for both the button and toast retry.
    if (!receipt) { receipt = { scope, requestId: crypto.randomUUID(), promise: null }; publication.current = receipt; }
    const requestId = receipt.requestId;
    const promise = (async () => {
      const ok = await run(() => goLiveCall(pageRef, requestId), { label: pt('Your page is live'), retry: () => { void publish(); } });
      if (!ok || !isActive(origin)) return false;
      openPanel('live');
      return true;
    })();
    receipt.promise = promise;
    try { return await promise; }
    finally { if (receipt.promise === promise) receipt.promise = null; }
  }, [isActive, openPanel, pageRef, run, scope]);

  // Keep the queue durable and ordered. A failed/conflicted receipt and its tail wait for retry or another visit.
  useEffect(() => {
    if (!page || !canEdit || replayed.current === scope || !isActive()) return;
    replayed.current = scope;
    const origin = lease.current;
    const kept = readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? [];
    if (!kept.length) return;
    const receipts = recovery.edits.flatMap(edit => {
      const index = kept.findIndex(item => edit.id ? item.id === edit.id : JSON.stringify(item) === JSON.stringify(edit));
      if (index < 0) return [];
      const receipt = kept[index].id ? kept[index] : { ...kept[index], id: crypto.randomUUID() };
      kept[index] = receipt;
      return [receipt];
    });
    if (!receipts.length) return;
    // Preserve edits made during this visit while assigning ids to older, legacy receipts.
    store(kept);
    void (async () => {
      await Promise.resolve();
      for (const edit of receipts) {
        if (!isActive(origin)) break;
        if (!(readSetupRecovery(userId, pendingKey(pageRef), validPending) ?? []).some(item => item.id === edit.id)) continue;
        const before = pageState.current;
        if (!before) break;
        const options = { label: pt('Saved what you changed last time'), remember: edit, replay: true };
        const undo = edit.kind === 'identity'
          ? (current: PageView) => saveIdentityCall(pageRef, current.identity.version, Object.fromEntries(Object.keys(edit.patch).map(field => [field, before.identity[field as keyof PageIdentity]])) as IdentityPatch)
          : edit.kind === 'box'
            ? (current: PageView) => saveBoxCall(pageRef, edit.key, current.boxes[edit.key].version, boxData(edit.key, before.boxes[edit.key]))
            : (current: PageView) => saveLayoutCall(pageRef, current.layout.version, { columns: before.layout.columns, hidden: before.layout.hidden });
        const withUndo = { ...options, undo };
        const ok = edit.kind === 'identity'
          ? await run(current => saveIdentityCall(pageRef, current.identity.version, edit.patch), withUndo)
          : edit.kind === 'box'
            ? await run(current => saveBoxCall(pageRef, edit.key, current.boxes[edit.key].version, edit.data), withUndo)
            : await run(current => saveLayoutCall(pageRef, current.layout.version, edit.layout), withUndo);
        if (!ok || !isActive(origin)) break;
      }
    })();
  }, [canEdit, isActive, page, pageRef, recovery, run, scope, store, userId]);

  const failed = Boolean(loaded?.key === key && loaded.failed), notFound = Boolean(loaded?.key === key && loaded.notFound);
  const value = useMemo<PageEdit>(() => ({
    pageRef, page, loading, failed, notFound, retry: () => setAttempt(value => value + 1),
    editing, canEdit, setEditing, panel, openPanel, openStep, closePanel, rearranging, setRearranging, arrival, status, pendingCount: pending.length,
    saveIdentity, saveBox, saveLayout, hideBox, showBox, moveBox, reorder, goLive, replace,
  }), [arrival, canEdit, closePanel, editing, failed, goLive, hideBox, loading, moveBox, notFound, openPanel, openStep, page, pageRef, panel, pending.length, rearranging, reorder, replace, saveBox, saveIdentity, saveLayout, setEditing, setRearranging, showBox, status]);
  return <PageEditContext.Provider value={value}>{children}</PageEditContext.Provider>;
}
