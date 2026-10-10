import type { ReactNode } from 'react';
import '../../../components/workspace/workspace-design-theme.css';

/**
 * Hosts a small older component (uploads, maps, visitor registers) inside a design-system page.
 * It supplies the older palette those components read, scoped to this block only.
 */
export function LegacyIsland({ children, className }: { children: ReactNode; className?: string }) {
    const light = typeof document !== 'undefined' && !document.documentElement.classList.contains('dark');
    return <div className={`workspace-page-shell club-workspace-shell workspace-refresh${light ? ' workspace-light' : ''}${className ? ` ${className}` : ''}`} style={{ background: 'transparent', height: 'auto', minHeight: 0 }}>{children}</div>;
}
