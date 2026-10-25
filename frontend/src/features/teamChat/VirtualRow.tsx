import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { VirtualRows } from './virtualRows';

/**
 * One message in the list: drawn while near the visible part (or while it is the one being jumped to), otherwise an
 * empty block of the same height that still answers to the message's address (#tc-m-<id>).
 */
export function VirtualRow({ id, rows, keep, children }: { id: number; rows: VirtualRows; keep: boolean; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const hidden = rows.hidden.has(id) && !keep;
    const { watch } = rows;
    useLayoutEffect(() => {
        const element = ref.current;
        return element ? watch(id, element) : undefined;
    }, [id, watch, hidden]);
    if (hidden) return <div ref={ref} id={`tc-m-${id}`} className="tc-vrow" data-row-id={id} data-placeholder=""
        style={{ height: rows.height(id) }} aria-hidden="true" />;
    return <div ref={ref} className="tc-vrow" data-row-id={id}>{children}</div>;
}
