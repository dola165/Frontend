/**
 * Which side of the marketplace the person is on, as Upwork separates "find work" from "hire": `work` looks at
 * jobs and lists yourself; `hire` looks at people available and posts jobs. Kept in the address and remembered.
 */
export type JobsMode = 'work' | 'hire';
const KEY = 'gk.jobs.mode';
export const readStoredMode = (): JobsMode => { try { return localStorage.getItem(KEY) === 'hire' ? 'hire' : 'work'; } catch { return 'work'; } };
export const storeMode = (mode: JobsMode) => { try { localStorage.setItem(KEY, mode); } catch { /* the choice lives in the address then */ } };
export const modeOf = (params: URLSearchParams): JobsMode => { const value = params.get('mode'); return value === 'hire' || value === 'work' ? value : readStoredMode(); };
export const modePath = (mode: JobsMode) => mode === 'work' ? '/jobs' : '/jobs?mode=hire';
