import { useSyncExternalStore } from 'react';
import type { AgentDolaGuide, AgentDolaGuideStep } from './agentDola';

/**
 * The step-by-step guide Agent Dola started ("help me fill out my profile"): which page, which fields, and the step on
 * screen. Kept for this tab only (sessionStorage), so it survives opening the page and a reload, and nothing else.
 */
export interface GuideState { guide: AgentDolaGuide; steps: AgentDolaGuideStep[]; index: number }

const KEY = 'agent-dola-guide';
const listeners = new Set<() => void>();

function read(): GuideState | null {
    try {
        const raw = window.sessionStorage.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as GuideState;
        return value && value.guide && Array.isArray(value.steps) && Number.isInteger(value.index) ? value : null;
    } catch { return null; }
}

let state: GuideState | null = typeof window === 'undefined' ? null : read();

function set(next: GuideState | null) {
    state = next;
    try {
        if (next) window.sessionStorage.setItem(KEY, JSON.stringify(next));
        else window.sessionStorage.removeItem(KEY);
    } catch { /* storage may be off; the guide still works on this page */ }
    listeners.forEach(listener => listener());
}

export const startGuide = (guide: AgentDolaGuide) => set({ guide, steps: guide.steps, index: 0 });
/** The page's own empty fields, read once Dola's page is open (a guide Dola could not list from the server). */
export const setGuideSteps = (steps: AgentDolaGuideStep[]) => { if (state) set({ ...state, steps, index: 0 }); };
export const goToStep = (index: number) => {
    if (state) set({ ...state, index: Math.max(0, Math.min(index, state.steps.length - 1)) });
};
export const stopGuide = () => set(null);
export const currentGuide = () => state;

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useGuide = () => useSyncExternalStore(subscribe, () => state, () => null);
