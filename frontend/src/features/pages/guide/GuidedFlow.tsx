import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { X } from 'lucide-react';
import { PetSprite } from './PetSprite';
import { useGuideCopy } from './copy';
import { useGuidePlacement } from './useGuidePlacement';
import type { GuideTask } from './types';
import './pet.css';
export type { GuideTask, GuideResult } from './types';

export interface GuidedFlowProps {
  /** Include the confirmed account and record identity. A new scope resets all pending UI. */
  flowId: string;
  title: string;
  tasks: GuideTask[];
  initialTaskId?: string;
  onTaskChange?: (id: string) => void;
  onFinish?: () => void;
  suspended?: boolean;
}
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* available for this visit */ } };

/** The single task runner used by club creation and operational pages. */
export function GuidedFlow(props: GuidedFlowProps) { return <Flow key={props.flowId} {...props} />; }
function Flow({ flowId, title, tasks, initialTaskId, onTaskChange, onFinish, suspended = false }: GuidedFlowProps) {
  const t = useGuideCopy();
  const progressKey = `gk-guide:${flowId}`;
  const [currentId, setCurrentId] = useState(() => read(progressKey) ?? initialTaskId ?? tasks[0]?.id);
  const [hidden, setHidden] = useState(() => read(`${progressKey}:hidden`) === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const at = Math.max(0, tasks.findIndex(item => item.id === currentId));
  const task = tasks[at];
  const taskId = task?.id;
  const card = useRef<HTMLElement>(null);
  const generation = useRef(0), locked = useRef(false), mounted = useRef(false);
  const latest = useRef({ task, tasks, onTaskChange, onFinish });
  const titleId = useId();
  useLayoutEffect(() => { latest.current = { task, tasks, onTaskChange, onFinish }; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const placement = useGuidePlacement(card, task?.target, !hidden && !suspended && !finished);
  useEffect(() => {
    if (hidden || suspended || !taskId || finished) return;
    latest.current.onTaskChange?.(taskId);
    latest.current.task?.enter?.();
    // Enter only on an actual step/visibility change, never on form typing or refreshed callback identities.
  }, [taskId, hidden, suspended, finished]);
  useEffect(() => {
    if (hidden || suspended || !taskId || finished || placement.obscured) return;
    const timer = window.setTimeout(() => {
      const input = card.current?.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled])');
      (input ?? card.current)?.focus({ preventScroll: true });
    }, 40);
    return () => clearTimeout(timer);
  }, [taskId, hidden, suspended, finished, placement.obscured, placement.host]);
  const move = (next: number, available = tasks) => {
    if (!available[next]) return;
    generation.current++;
    setError(''); setFinished(false); setCurrentId(available[next].id);
    // Back does not erase the furthest point reached during this visit.
    const remembered = available.findIndex(item => item.id === read(progressKey));
    if (next > remembered) write(progressKey, available[next].id);
  };
  const next = async (event: FormEvent) => {
    event.preventDefault();
    if (!task || locked.current || task.disabled) return;
    locked.current = true; setBusy(true); setError('');
    const token = generation.current;
    try {
      const result = await task.next();
      if (!mounted.current || token !== generation.current) return;
      // The adapter may have queued refreshed tasks in the same async batch as this result.
      flushSync(() => setBusy(false));
      if (!mounted.current || token !== generation.current || latest.current.task?.id !== task.id) return;
      if (result?.status !== 'complete') { setError(result?.message ?? t('Finish this step, or skip it for now.')); return; }
      // Refresh may add follow-up work or remove an earlier task while the save is pending.
      const available = latest.current.tasks, current = available.findIndex(item => item.id === task.id);
      if (current < available.length - 1) move(current + 1, available);
      else { setFinished(true); latest.current.onFinish?.(); }
    } catch {
      if (mounted.current && token === generation.current && latest.current.task?.id === task.id) setError(t('Not saved. Your answer is still here. Try Next again.'));
    } finally {
      if (mounted.current) { locked.current = false; setBusy(false); }
    }
  };
  const hide = () => { write(`${progressKey}:hidden`, '1'); setHidden(true); };
  if (!task) return null;
  return <>{!suspended && (hidden || finished) && createPortal(<div className="gk gk-pet-launcher"><button type="button" aria-label={t('Show Dola')} onClick={() => { write(`${progressKey}:hidden`, '0'); setHidden(false); setFinished(false); }}><PetSprite frame="Idle · front" /></button></div>, document.body)}{createPortal(
    <section ref={card} className="gk gk-guide" hidden={hidden || finished || suspended || placement.obscured} data-inline={placement.inline || undefined} data-in-dialog={placement.host !== document.body || undefined} aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}
      style={placement.inline ? { maxHeight: placement.maxHeight } : { left: placement.left, top: placement.top, maxHeight: placement.maxHeight }}>
      <header className="gk-guide__head">
        <PetSprite frame={busy ? 'Thinking' : 'Wave'} className="gk-guide__fox" />
        <div><span className="gk-guide__context">{t('Dola')} · {title}</span><strong id={titleId}>{task.title}</strong><span className="gk-guide__count" aria-live="polite">{at + 1} / {tasks.length}</span></div>
        <button type="button" className="gk-guide__hide" disabled={busy} aria-label={t('Hide Dola')} onClick={hide}><X aria-hidden="true" /></button>
      </header>
      <form onSubmit={event => void next(event)} className="gk-guide__form">
        <div className="gk-guide__content" key={task.id}>
          {task.description && <p>{task.description}</p>}
          <fieldset disabled={busy}>{task.content}</fieldset>
          {error && <p className="gk-guide__error" role="alert">{error}</p>}
        </div>
        <footer className="gk-guide__actions">
          <button type="button" disabled={busy || at === 0} onClick={() => move(at - 1)}>{t('Back')}</button>
          {task.canSkip !== false && <button type="button" disabled={busy} onClick={() => { if (at < tasks.length - 1) move(at + 1); else setFinished(true); }}>{t('Skip')}</button>}
          <button type="submit" className="gk-guide__next" disabled={busy || task.disabled}>{busy ? t('Saving…') : task.nextLabel ?? t('Next')}</button>
        </footer>
      </form>
    </section>, placement.host.isConnected ? placement.host : document.body,
  )}</>;
}
