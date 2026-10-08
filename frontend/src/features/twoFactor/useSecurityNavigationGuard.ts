import { useEffect } from 'react';

const guards = new Set<() => boolean>();
export const confirmSecurityNavigation = () => [...guards].every(guard => guard());

/** Warn on links, account-tab changes and document exits. Same-account back navigation retains secrets in memory. */
export function useSecurityNavigationGuard(dirty: boolean, busy: boolean) {
    useEffect(() => {
        if (!dirty && !busy) return;
        const canLeave = () => !busy && window.confirm('Authenticator setup or recovery codes are still open. Save your recovery codes before leaving. Leave this screen?');
        guards.add(canLeave);
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        const click = (event: MouseEvent) => {
            const link = (event.target as Element | null)?.closest?.('a[href]');
            if (link && !link.hasAttribute('download')) {
                if (!canLeave()) { event.preventDefault(); event.stopPropagation(); }
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        document.addEventListener('click', click, true);
        return () => {
            guards.delete(canLeave);
            window.removeEventListener('beforeunload', beforeUnload);
            document.removeEventListener('click', click, true);
        };
    }, [dirty, busy]);
}
