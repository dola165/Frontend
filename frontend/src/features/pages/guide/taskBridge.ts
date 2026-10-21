import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { GuideTaskAdapter, GuideResult } from './types';

const adapters = new Map<string, GuideTaskAdapter>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** Unmount unregisters the editor; late saves cannot claim a newly mounted editor. */
export function useGuideTask(panel: string, adapter: GuideTaskAdapter) {
  const latest = useRef(adapter);
  useEffect(() => { latest.current = adapter; });
  const { disabled, nextLabel } = adapter;
  useEffect(() => {
    const registered: GuideTaskAdapter = { next: () => latest.current.next(), disabled, nextLabel };
    adapters.set(panel, registered);
    emit();
    return () => { if (adapters.get(panel) === registered) { adapters.delete(panel); emit(); } };
  }, [panel, disabled, nextLabel]);
}
export const useGuideTaskAdapter = (panel: string) => useSyncExternalStore(subscribe, () => adapters.get(panel) ?? null, () => null);
export async function runGuideTask(panel: string): Promise<GuideResult> {
  const adapter = adapters.get(panel);
  if (!adapter || adapter.disabled) return { status: 'stay' };
  return adapter.next();
}
