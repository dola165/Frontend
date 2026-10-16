import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * How a step's pop-up takes an answer typed to Dola: the pop-up registers what to do with the words (add the ground,
 * tick the years) through its own state, exactly as a tap would, and says back what it did. Null: not understood.
 */
export type PetAnswerHandler = (text: string) => string | null;
const handlers = new Map<string, PetAnswerHandler>();

/** A pop-up that can be answered through Dola. */
export function usePetAnswer(panel: string, handler: PetAnswerHandler) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const run: PetAnswerHandler = text => latest.current(text);
    handlers.set(panel, run);
    return () => { if (handlers.get(panel) === run) handlers.delete(panel); };
  }, [panel]);
}

export const panelListens = (panel: string) => handlers.has(panel);
export const answerPanel = (panel: string, text: string) => handlers.get(panel)?.(text) ?? null;

/**
 * What a pop-up wants Dola to do next: run to a part of it (`selector`) and say `line` there, or say `said` once the
 * person did it. Null: her usual line for the pop-up.
 */
export interface PetHint { selector?: string; line?: string; said?: string }
const hints = new Map<string, PetHint>();
const listeners = new Set<() => void>();
export function setPetHint(panel: string, hint: PetHint | null) {
  if (hint) hints.set(panel, hint); else hints.delete(panel);
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const usePetHint = (panel: string | null) => useSyncExternalStore(subscribe, () => (panel ? hints.get(panel) ?? null : null), () => null);
