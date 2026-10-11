import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { peekClick, usePeek } from '../peek/usePeek';
import { counterpartProps, useMapCounterpart } from './selection';
import './result-row.css';

/** Something inside the row that does its own thing (a link, a button, a field). */
const OWN_ACTION = 'a, button, input, select, textarea, label, summary, [role="button"]';

/**
 * One search result, the way LinkedIn lists people and jobs: a face or crest, the name as the link, a few quiet lines
 * under it, and at the end one number worth seeing (a price) and one action. The name opens the result's drawer;
 * so does a click anywhere else on the row. The row lights up while its drawer is open or its pin has the pointer.
 */
export function ResultRow({ lead, title, to, peek, label, mark, lines, aside, action }: {
    lead: ReactNode; title: string; /** The full page, for a new tab or without drawers. */ to: string;
    /** The drawer the row opens (`person-12`, `job-3`). */ peek?: string; /** The link's name, when the title alone says too little. */ label?: string;
    /** A short mark after the name: a licence, a referee's level, a position. */ mark?: ReactNode;
    lines: ReactNode[]; aside?: ReactNode; action?: ReactNode;
}) {
    const drawers = usePeek();
    const linked = counterpartProps(useMapCounterpart());
    const open = peekClick(peek, drawers.open);
    const rowClick = (event: MouseEvent<HTMLElement>) => {
        if (!peek || (event.target as Element).closest(OWN_ACTION) || window.getSelection()?.toString()) return;
        drawers.open(peek);
    };
    const shown = lines.filter(line => line != null && line !== false && line !== '');
    return (
        <li>
            <article className="gk-result" data-open={(peek && drawers.value === peek) || undefined} data-clickable={peek ? true : undefined} onClick={rowClick} {...linked}>
                <span className="gk-result__lead">{lead}</span>
                <div className="gk-result__main">
                    <div className="gk-result__name">
                        <Link className="gk-result__title" to={to} onClick={open} aria-label={label}>{title}</Link>
                        {mark}
                    </div>
                    {shown.map((line, index) => <div key={index} className="gk-result__line" data-line={index}>{line}</div>)}
                </div>
                {aside && <div className="gk-result__aside">{aside}</div>}
                {action && <div className="gk-result__action">{action}</div>}
            </article>
        </li>
    );
}

/** A short mark after a result's name ("UEFA A", "REG 2", "ST"); dashed when the person states it themselves. */
export function ResultMark({ children, tone, stated, label, icon }: { children?: ReactNode; tone?: 'accent' | 'info' | 'violet' | 'warning'; stated?: boolean; label: string; icon?: ReactNode }) {
    return <span className="gk-result__mark" data-tone={tone} data-stated={stated || undefined} title={label} aria-label={label} role="img">{icon}{children}</span>;
}
