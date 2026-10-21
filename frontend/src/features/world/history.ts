/**
 * Whether the person has gone Back or Forward since the page loaded. The router reports the page load itself as a
 * return (POP) too, so a list can only tell a real return (restore the scroll, keep their filters) by this.
 */
const load = typeof performance !== 'undefined' ? performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined : undefined;
/** True from the start when Back or Forward loaded this document, and from the first popstate otherwise. */
let returned = load?.type === 'back_forward';
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { returned = true; });

/** A real Back or Forward, not the page load. */
export const isReturn = (navigation: string) => navigation === 'POP' && returned;
