import { useEffect, useRef } from 'react';

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
