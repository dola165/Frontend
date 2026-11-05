/**
 * The signal that someone's responsibilities changed (a job taken, ended or handed over), for answers that follow
 * them, such as who they may post as. `refreshAccess` announces it after a change made here; the auth provider
 * announces it after refreshing `/users/me`, even when the workspace shortcuts stay the same.
 */
const listeners = new Set<() => void>();
export const onAccessRefresh = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const announceAccessRefresh = () => { listeners.forEach(listener => listener()); };
