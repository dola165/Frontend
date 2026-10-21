import { useEffect, useRef, type ReactNode } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { Button } from '../../design/primitives';
import { WorkspaceOperations } from './WorkspaceOperations';
import { EditorScope } from './workspaceGuard';
import type { Bootstrap } from './api';
import './work-drawer.css';

/**
 * A club tool opened from a side sheet: it slides in from the left and fills the page up to the sheet, so the
 * work happens beside the player instead of on another page. Its search, filters and open record live in the
 * URL under `tool.`; closing slides it back out. Render it inside the sheet, which keeps focus and Escape.
 */
export function WorkDrawer({ boot, module, label, context, closing, onClose, onClosed, onRefresh }: {
    boot: Bootstrap; module: string; label: string;
    /** Who or what the tool is open for, shown quietly in its bar. */ context: ReactNode;
    /** Sliding out; `onClosed` runs when it has gone. */ closing: boolean;
    onClose: () => void; onClosed: () => void; onRefresh: () => Promise<void>;
}) {
    const ref = useRef<HTMLElement>(null);
    // Focus follows the tool that was opened, so the keyboard continues where the eye goes.
    useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [module]);
    return <section ref={ref} tabIndex={-1} className="gk-drawer" data-closing={closing || undefined} aria-label={label}
        onAnimationEnd={event => { if (closing && event.target === event.currentTarget) onClosed(); }}>
        <div className="gk-drawer__bar">
            <span className="gk-drawer__context">{context}</span>
            {/* Slides back to the left, beside the sheet's own close: a different symbol, so the two never look alike. */}
            <Button variant="ghost" iconOnly aria-label={`Close ${label}`} title="Close (Esc)" onClick={onClose}><PanelLeftClose aria-hidden="true" /></Button>
        </div>
        <div className="gk-drawer__body" key={module}>
            <EditorScope.Provider value="tool"><WorkspaceOperations scope="tool" boot={boot} module={module} onRefresh={onRefresh} /></EditorScope.Provider>
        </div>
    </section>;
}
