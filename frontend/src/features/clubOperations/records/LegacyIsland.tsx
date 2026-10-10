import { useSyncExternalStore, type ReactNode } from 'react';
import '../../../components/workspace/workspace-design-theme.css';

// The app sets the theme class on <html> after it renders, so the island follows the class itself
// rather than reading it once during render (which left islands in the old theme after a switch).
const subscribe = (change: () => void) => {
    const observer = new MutationObserver(change);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
};
const isLight = () => !document.documentElement.classList.contains('dark');

/**
 * Hosts a small older component (uploads, maps, facility cards) inside a design-system page.
 * It supplies the older palette those components read, scoped to this block only.
 */
export function LegacyIsland({ children, className }: { children: ReactNode; className?: string }) {
    const light = useSyncExternalStore(subscribe, isLight, () => false);
    return <div className={`workspace-page-shell club-workspace-shell workspace-refresh${light ? ' workspace-light' : ''}${className ? ` ${className}` : ''}`} style={{ background: 'transparent', height: 'auto', minHeight: 0 }}>{children}</div>;
}
