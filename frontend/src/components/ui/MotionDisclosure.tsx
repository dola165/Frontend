import { useState, type ReactNode } from 'react';

/** Mount on first expansion, then retain drafts and scroll through both directions. */
export function MotionDisclosure({ open, children, className = 'feed-comments-reveal' }: { open: boolean; children: ReactNode; className?: string }) {
    const [visited, setVisited] = useState(open);
    if (open && !visited) setVisited(true);
    return <div className={className} data-open={open} data-minimized={!open} aria-hidden={!open} inert={!open}>
        <div>{(visited || open) && children}</div>
    </div>;
}
