import { useSyncExternalStore } from 'react';

let state = { planning: false, navigationExpanded: false };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => state;
export const useMapWorkspaceChrome = () => useSyncExternalStore(subscribe, snapshot, snapshot);
export function setMapPlanning(active: boolean) {
  if (active === state.planning) return;
  state = { planning: active, navigationExpanded: false };
  listeners.forEach(listener => listener());
}
export function setPlanningNavigation(expanded: boolean) {
  state = { ...state, navigationExpanded: expanded };
  listeners.forEach(listener => listener());
}
