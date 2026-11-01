import type { MouseEvent } from 'react';
import { guardWorkspaceNavigation } from '../clubOperations/workspaceGuard';

/** Only same-tab navigation retires an editor; modified/new-tab clicks retain normal links. */
export function guardScoutingLink(event: MouseEvent, navigate: (to: string) => void) {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        || link.target && link.target !== '_self' || link.hasAttribute('download') || link.origin !== location.origin) return;
    event.preventDefault();
    guardWorkspaceNavigation(() => navigate(link.pathname + link.search + link.hash));
}
