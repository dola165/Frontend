import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
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
  const [index, setIndex] = useState(() => {
    const stored = read(progressKey), at = tasks.findIndex(task => task.id === (stored ?? initialTaskId));
    return Math.max(0, at);
  });
  const [hidden, setHidden] = useState(() => read(`${progressKey}:hidden`) === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const at = Math.min(index, Math.max(0, tasks.length - 1));
  const task = tasks[at];
  const card = useRef<HTMLElement>(null);
  const generation = useRef(0), locked = useRef(false), mounted = useRef(false);
  const latest = useRef({ task, onTaskChange });
  const titleId = useId();
  useEffect(() => { latest.current = { task, onTaskChange }; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => {
    if (hidden || suspended || !task || finished) return;
    latest.current.onTaskChange?.(task.id);
    latest.current.task?.enter?.();
    const timer = window.setTimeout(() => {
      const input = card.current?.querySelector<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled])');
      (input ?? card.current)?.focus({ preventScroll: true });
    }, 40);
    return () => clearTimeout(timer);
    // Enter only on an actual step/visibility change, never on form typing or refreshed callback identities.
  }, [task?.id, hidden, suspended, finished]);
  const placement = useGuidePlacement(card, task?.target, !hidden && !suspended && !finished);
  const move = (next: number) => {
    generation.current++;
    setError(''); setFinished(false); setIndex(next);
    // Back does not erase the furthest point reached during this visit.
    const remembered = tasks.findIndex(item => item.id === read(progressKey));
    if (next > remembered && tasks[next]) write(progressKey, tasks[next].id);
  };
  const next = async (event: FormEvent) => {
    event.preventDefault();
    if (!task || locked.current || task.disabled) return;
    locked.current = true; setBusy(true); setError('');
    const token = generation.current;
    try {
      const result = await task.next();
      if (!mounted.current || token !== generation.current) return;
      if (result?.status !== 'complete') { setError(result?.message ?? t('Finish this step, or skip it for now.')); return; }
      if (at < tasks.length - 1) move(at + 1);
      else { setFinished(true); onFinish?.(); }
    } catch {
      if (mounted.current && token === generation.current) setError(t('Not saved. Your answer is still here. Try Next again.'));
    } finally {
      if (mounted.current) { locked.current = false; setBusy(false); }
    }
  };
  const hide = () => { write(`${progressKey}:hidden`, '1'); setHidden(true); };
  if (!task || suspended) return null;
  if (hidden || finished) return createPortal(<div className="gk gk-pet-launcher"><button type="button" aria-label={t('Show Dola')} onClick={() => { write(`${progressKey}:hidden`, '0'); setHidden(false); setFinished(false); }}><PetSprite frame="Idle · front" /></button></div>, document.body);
  return createPortal(
    <section ref={card} className="gk gk-guide" data-inline={placement.inline || undefined} aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}
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
          {task.canSkip !== false && at < tasks.length - 1 && <button type="button" disabled={busy} onClick={() => move(at + 1)}>{t('Skip')}</button>}
          <button type="submit" className="gk-guide__next" disabled={busy || task.disabled}>{busy ? t('Saving…') : task.nextLabel ?? t('Next')}</button>
        </footer>
      </form>
    </section>, placement.host.isConnected ? placement.host : document.body,
  );
}
