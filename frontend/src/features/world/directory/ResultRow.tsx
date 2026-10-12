import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PanelRightOpen } from 'lucide-react';
import { useWorldCopy } from '../copy';
import { counterpartProps, useMapCounterpart } from './selection';
import { keptLines, useResultPress } from './useResultPress';
import './result-row.css';

/**
 * One search result, the way LinkedIn lists jobs and companies: a crest, face or date, the name as the link, a few
 * quiet lines under it, and at the end one number worth seeing (a price, a status) and one action. The name goes to
 * the full page; a press anywhere else on the row, or its details button at the end, shows the result beside the list
 * (or in a drawer). The row lights up while it is shown or its pin has the pointer.
 */
export function ResultRow({ lead, title, to, peek, label, mark, lines, aside, action }: {
    lead: ReactNode; title: string; /** The full page. */ to: string;
    /** What the row shows beside the list (`club-7`, `job-3`). */ peek?: string; /** The link's name, when the title alone says too little. */ label?: string;
    /** A short mark after the name: a licence, a referee's level, a verified tick. */ mark?: ReactNode;
    lines: ReactNode[]; aside?: ReactNode; action?: ReactNode;
}) {
    const linked = counterpartProps(useMapCounterpart());
    const { press, shown } = useResultPress(peek);
    const kept = keptLines(lines);
    return (
        <li>
            <article className="gk-result" data-open={shown || undefined} data-clickable={peek ? true : undefined} onClick={press} {...linked}>
                <span className="gk-result__lead">{lead}</span>
                <div className="gk-result__main">
                    <div className="gk-result__name">
                        <Link className="gk-result__title" to={to} aria-label={label}>{title}</Link>
                        {mark}
                    </div>
                    {kept.map((line, index) => <div key={index} className="gk-result__line" data-line={index}>{line}</div>)}
                </div>
                {aside && <div className="gk-result__aside">{aside}</div>}
                {action && <div className="gk-result__action">{action}</div>}
                {peek && <DetailsButton peek={peek} name={title} />}
            </article>
        </li>
    );
}

/** The button at a result's end that shows it beside the list, and closes it again (a toggle, pressed while shown). */
export function DetailsButton({ peek, name }: { peek: string; name: string }) {
    const t = useWorldCopy();
    const { toggle, shown } = useResultPress(peek);
    return (
        <button type="button" className="gk-result__more" onClick={toggle} data-peek={peek} aria-pressed={shown} aria-label={t('Details of {name}', { name })} title={t('Details')}>
            <PanelRightOpen aria-hidden="true" />
        </button>
    );
}

/** A result's date or time where a crest would be: the big part on top ("14", "11:00"), the small under it ("Oct", "Wed 14"). */
export function DateLead({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
    return <span className="gk-result-date"><b>{top}</b>{bottom && <small>{bottom}</small>}</span>;
}

/**
 * A short mark of what kind of football person someone is ("UEFA A", "REG 2", "ST"): after a name in a row (a soft
 * pill), or in a card's corner as a football card shows a position. Dashed when the person states it themselves.
 */
export function ResultMark({ children, tone, stated, label, icon, variant = 'pill' }: {
    children?: ReactNode; tone?: 'accent' | 'info' | 'violet' | 'warning'; stated?: boolean; label: string; icon?: ReactNode; variant?: 'pill' | 'corner';
}) {
    return <span className="gk-result__mark" data-variant={variant} data-tone={tone} data-stated={stated || undefined} title={label} aria-label={label} role="img">{icon}{children}</span>;
}
